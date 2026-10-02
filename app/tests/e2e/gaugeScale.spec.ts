/**
 * Issue #3 tweak: scale labels under each stat gauge (selection card and star
 * panel share StarStatTiles) and the "Temperature" label. Scale labels are the
 * 9px aria-hidden spans of the Gauge.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const STATS = ['stat-distance', 'stat-teff', 'stat-luminosity', 'stat-appmag'] as const;

async function selectPolaris(page: Page, lang?: 'it') {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  if (lang) {
    await page.getByTestId('language-button').click();
    await page.getByTestId(`language-option-${lang}`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('star-panel')).toBeVisible();
  await waitForFlyToArrival(page);
}

const EXPECTED: Record<string, (lang: 'en' | 'it') => string[]> = {
  'stat-distance': (l) => ['1', '10', '100', l === 'it' ? '1.000' : '1,000'],
  'stat-teff': () => ['M', 'K', 'G', 'F', 'A', 'B'],
  'stat-luminosity': () => ['10⁻³', '1', '10³'],
  // The 10 tick is mark-only (no label); naked eye is the i18n word label.
  'stat-appmag': (l) => ['0', '20', l === 'it' ? 'occhio nudo' : 'naked eye'],
};

for (const lang of ['en', 'it'] as const) {
  test(`Polaris (${lang}): scale labels in card and panel, inside their tile`, async ({ page }) => {
    await selectPolaris(page, lang === 'it' ? 'it' : undefined);
    for (const root of ['selection-card', 'star-panel']) {
      // One round trip per root: text and rects of every stat tile and label.
      const data = await page.getByTestId(root).evaluate(
        (el, ids) =>
          Object.fromEntries(
            ids.map((id) => {
              const tile = el.querySelector(`[data-testid="${id}"]`)!;
              const t = tile.getBoundingClientRect();
              const labels = [...tile.querySelectorAll('[class*="text-[9px]"][aria-hidden="true"]')]
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
    }
  });
}

test('card stays inside the viewport and above the dock (Polaris, taller card)', async ({
  page,
}) => {
  await selectPolaris(page);
  const card = (await page.getByTestId('selection-card').boundingBox())!;
  const dock = (await page.getByTestId('dock').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(vp.width);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(vp.height);
  expect(card.y + card.height).toBeLessThanOrEqual(dock.y);
  const noHScroll = await page
    .getByTestId('star-panel')
    .evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(noHScroll).toBe(true);
});

test('selection card and star panel have no blocking axe violations', async ({ page }) => {
  await selectPolaris(page);
  for (const include of ['[data-testid="selection-card"]', '[data-testid="star-panel"]']) {
    const results = await new AxeBuilder({ page }).exclude('canvas').include(include).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  }
});
