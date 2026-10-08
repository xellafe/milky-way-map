/**
 * Issue #3 tweak: scale labels under each stat gauge (selection card and star
 * panel share StarStatTiles) and the "Temperature" label. Scale labels are the
 * Gauge spans marked `data-gauge-label="tick"`; zone labels use "zone".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const STATS = ['stat-distance', 'stat-teff', 'stat-luminosity', 'stat-appmag'] as const;

async function selectStar(page: Page, lang?: 'it', query = 'polaris', name = 'Polaris') {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  if (lang) {
    await page.getByTestId('language-button').click();
    await page.getByTestId(`language-option-${lang}`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await waitForFlyToArrival(page);
}

const EXPECTED: Record<string, (lang: 'en' | 'it') => string[]> = {
  'stat-distance': (l) => ['1', '10', '100', l === 'it' ? '1.000' : '1,000'],
  'stat-teff': () => ['M', 'K', 'G', 'F', 'A', 'B'],
  'stat-luminosity': () => ['10⁻³', '1', '10³'],
  // Inverted axis (#23): 20 at the left end, −1 at the right end.
  'stat-appmag': () => ['20', '9', '6', '−1'],
};

for (const lang of ['en', 'it'] as const) {
  test(`Polaris (${lang}): scale labels in the card, inside their tile`, async ({ page }) => {
    await selectStar(page, lang === 'it' ? 'it' : undefined);
    const root = 'selection-card';
    // One round trip per root: text and rects of every stat tile and label.
    const data = await page.getByTestId(root).evaluate(
      (el, ids) =>
        Object.fromEntries(
          ids.map((id) => {
            const tile = el.querySelector(`[data-testid="${id}"]`)!;
            const t = tile.getBoundingClientRect();
            const labels = [...tile.querySelectorAll('[data-gauge-label="tick"]')]
              .filter((l) => /\S/.test(l.textContent ?? ''))
              .map((l) => {
                const b = l.getBoundingClientRect();
                return { text: (l.textContent ?? '').trim(), x: b.x, right: b.right };
              });
            return [id, { x: t.x, right: t.right, text: tile.textContent ?? '', labels }];
          }),
        ),
      [...STATS],
    );
    for (const id of STATS) {
      const { x, right, labels } = data[id]!;
      const texts = labels.map((l) => l.text);
      for (const want of EXPECTED[id]!(lang)) expect(texts, `${root} ${id}`).toContain(want);
      for (const l of labels) {
        expect(l.x, `${root} ${id} left`).toBeGreaterThanOrEqual(x - 0.5);
        expect(l.right, `${root} ${id} right`).toBeLessThanOrEqual(right + 0.5);
      }
      const sorted = [...labels].sort((p, q) => p.x - q.x);
      sorted.slice(1).forEach((l, i) => {
        const prev = sorted[i]!;
        expect(l.x, `${root} ${id}: "${prev.text}" overlaps "${l.text}"`).toBeGreaterThanOrEqual(
          prev.right,
        );
      });
    }
    expect(data['stat-appmag']!.labels.map((l) => l.text)).not.toContain('10');
    const teff = data['stat-teff']!.text;
    expect(teff).toContain(lang === 'it' ? 'Temperatura' : 'Temperature');
    expect(teff).not.toMatch(lang === 'it' ? /efficace/i : /effective/i);
  });
}

test('card stays inside the viewport and above the dock (Polaris, taller card)', async ({
  page,
}) => {
  await selectStar(page);
  const card = (await page.getByTestId('selection-card').boundingBox())!;
  const dock = (await page.getByTestId('dock').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(vp.width);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(vp.height);
  expect(card.y + card.height).toBeLessThanOrEqual(dock.y);
  const noHScroll = await page
    .getByTestId('selection-card')
    .evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(noHScroll).toBe(true);
});

test('selection card has no blocking axe violations', async ({ page }) => {
  await selectStar(page);
  const results = await new AxeBuilder({ page })
    .exclude('canvas')
    .include('[data-testid="selection-card"]')
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

const en = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../src/i18n/locales/en.json', import.meta.url)), 'utf8'),
) as {
  gauge: Record<string, string>;
};

// pos(v) on the inverted magnitude axis: 20 → 0, −1 → 1.
const pos = (m: number) => (20 - m) / 21;

async function markerFraction(page: Page): Promise<number> {
  const tile = page.getByTestId('selection-card').getByTestId('stat-appmag');
  const meter = (await tile.getByRole('meter').boundingBox())!;
  const marker = (await tile.getByTestId('gauge-marker').boundingBox())!;
  return (marker.x + marker.width / 2 - meter.x) / meter.width;
}

test('Polaris: naked-eye verdict, marker right of the naked-eye zone start', async ({ page }) => {
  await selectStar(page);
  const verdict = page.getByTestId('selection-card').getByTestId('stat-appmag-verdict');
  await expect(verdict).toHaveText(en.gauge.verdictNakedEye!);
  expect(await markerFraction(page)).toBeGreaterThan(pos(6));
});

test('Proxima Cen: telescope verdict, marker left of the binocular zone start', async ({
  page,
}) => {
  await selectStar(page, undefined, 'proxima', 'Proxima Cen');
  const verdict = page.getByTestId('selection-card').getByTestId('stat-appmag-verdict');
  await expect(verdict).toHaveText(en.gauge.verdictTelescope!);
  expect(await markerFraction(page)).toBeLessThan(pos(9));
});

const ZONE_LABELS = { en: ['naked eye', 'binoculars'], it: ['occhio nudo', 'binocolo'] } as const;

for (const lang of ['en', 'it'] as const) {
  test(`Polaris (${lang}): zone labels sit inside the tile and do not touch`, async ({ page }) => {
    await selectStar(page, lang === 'it' ? 'it' : undefined);
    const tile = page.getByTestId('selection-card').getByTestId('stat-appmag');
    const [nakedText, binoText] = ZONE_LABELS[lang];
    const t = (await tile.boundingBox())!;
    const naked = (await tile
      .locator('[data-gauge-label="zone"]')
      .getByText(nakedText, { exact: true })
      .first()
      .boundingBox())!;
    const bino = (await tile
      .locator('[data-gauge-label="zone"]')
      .getByText(binoText, { exact: true })
      .first()
      .boundingBox())!;
    for (const b of [naked, bino]) {
      expect(b.x).toBeGreaterThanOrEqual(t.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(t.x + t.width + 0.5);
      expect(b.y).toBeGreaterThanOrEqual(t.y - 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(t.y + t.height + 0.5);
    }
    expect(bino.x + bino.width).toBeLessThan(naked.x);
  });
}

test('Polaris: plain gauge tracks have a visible background (regression #23)', async ({ page }) => {
  await selectStar(page);
  const tracks = await page
    .getByTestId('selection-card')
    .locator('[role=meter]')
    .evaluateAll((els) =>
      els
        .map((el) => getComputedStyle(el))
        .filter((s) => s.backgroundImage === 'none')
        .map((s) => s.backgroundColor),
    );
  expect(tracks.length).toBeGreaterThan(0);
  for (const color of tracks) {
    // Computed colour is `rgba(r, g, b, a)`; fully transparent is `rgba(0, 0, 0, 0)`.
    const alpha = color.startsWith('rgba') ? Number(color.split(',')[3]!.replace(')', '')) : 1;
    expect(alpha, `track background ${color}`).toBeGreaterThan(0);
  }
});
