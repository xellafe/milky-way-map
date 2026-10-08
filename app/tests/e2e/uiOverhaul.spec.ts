/**
 * #23: single-source star data (an age is shown once), card placement with the dock
 * panel open, card mode persistence, dock tab semantics, counter name, one-row time
 * bar, tile labels in the System View left panel, unanchored planet card timing.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFixtureExoplanets, serveFixtureData, serveMutatedExoplanets } from './fixtures';

type Lang = 'en' | 'it' | 'de';

async function openApp(page: Page, lang?: Lang) {
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  if (lang && lang !== 'en') {
    await page.getByTestId('language-button').click();
    await page.getByTestId(`language-option-${lang}`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
}

async function selectStar(page: Page, query: string, name: string) {
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  await expect(page.getByTestId('selection-card')).toBeVisible();
}

async function enterAnchoredSystem(page: Page, query: string, name: string) {
  await selectStar(page, query, name);
  const button = page.getByTestId('view-system-button');
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByTestId('system-title')).toHaveText(name);
}

async function enterTrappist(page: Page) {
  await page.getByTestId('search-input').fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
}

const centreY = (b: { y: number; height: number }) => b.y + b.height / 2;

// --- the age appears once ------------------------------------------

test('Proxima Cen with an age: shown once in the card Advanced and once in the left panel', async ({
  page,
}) => {
  // TRAPPIST-1's real archive value, injected: Proxima Cen has none of its own.
  const age = readFixtureExoplanets().hosts['TRAPPIST-1']!['st_age'] as number;
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const h = d.hosts['Proxima Cen']!;
    h['st_age'] = age;
    h['st_agelim'] = 0;
  });
  await openApp(page);
  await selectStar(page, 'proxima cen', 'Proxima Cen');
  await page.getByTestId('card-mode-advanced').click();
  const card = page.getByTestId('selection-card');
  await expect(page.getByTestId('card-advanced')).toBeVisible();
  await expect(card.getByTestId('star-age')).toHaveCount(1);
  await expect(card.getByTestId('adv-st_age')).toHaveCount(0);
  await expect(card.getByText(/Gyr/)).toHaveCount(1);

  await page.getByTestId('view-system-button').click();
  await expect(page.getByTestId('system-title')).toHaveText('Proxima Cen');
  const panel = page.getByTestId('system-star-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('star-age')).toHaveCount(1);
  await expect(panel.getByTestId('adv-st_age')).toHaveCount(0);
  await expect(panel.getByText(/Gyr/)).toHaveCount(1);
});

test('TRAPPIST-1 (unanchored): the left panel keeps the archive age row', async ({ page }) => {
  await serveFixtureData(page);
  await openApp(page);
  await enterTrappist(page);
  const panel = page.getByTestId('system-star-panel');
  await expect(panel.getByTestId('adv-st_age')).toHaveCount(1);
  await expect(panel.getByTestId('star-age')).toHaveCount(0);
});

// --- the open dock panel does not shrink the star card -------------------

test('1280x720: opening a dock panel does not shrink the star card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await serveFixtureData(page);
  await openApp(page);
  await selectStar(page, 'polaris', 'Polaris');
  await page.waitForTimeout(2800); // fly-to
  const card = page.getByTestId('selection-card');
  const closed = (await card.boundingBox())!;
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
  await page.waitForTimeout(600); // the usable area is re-read every frame
  const open = (await card.boundingBox())!;
  expect(open.height).toBeGreaterThanOrEqual(closed.height - 1);
});

// --- leaving Advanced is robust -------------------------------------------

test('Base then close within 100 ms: the card reopens in Base after a reload', async ({ page }) => {
  await serveFixtureData(page);
  await openApp(page);
  await selectStar(page, 'polaris', 'Polaris');
  await page.getByTestId('card-mode-advanced').click();
  await expect(page.getByTestId('card-advanced')).toBeVisible();
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    q('card-mode-base').click();
    await new Promise((r) => setTimeout(r, 50));
    q('overlay-close').click();
  });
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await selectStar(page, 'polaris', 'Polaris');
  await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'base');
});

// --- dock semantics ----------------------------------------------------------

test('dock: the tabpanel does not contain the tablist', async ({ page }) => {
  await serveFixtureData(page);
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
  const panels = page.locator('[role="tabpanel"]');
  await expect(panels).toHaveCount(1);
  await expect(panels.locator('[role="tablist"]')).toHaveCount(0);
});

test('dock: the visible-count has an accessible name containing the count', async ({ page }) => {
  await serveFixtureData(page);
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  const counter = page.getByTestId('visible-count');
  await expect(counter).toBeVisible();
  await expect(counter).toHaveText(/\d/);
  const text = ((await counter.textContent()) ?? '').trim();
  const name = await counter.evaluate((el) => el.getAttribute('aria-label') ?? '');
  expect(name).toContain(text);
  expect(name.length).toBeGreaterThan(text.length);
  await expect(counter).toHaveAccessibleName(name);
});

// --- the time bar is a single row ---------------------------------------------------

test('1280x720: time bar pause, slider, value and log toggle share one row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await serveFixtureData(page);
  await openApp(page);
  await enterTrappist(page);
  const bar = page.getByTestId('time-scale');
  await expect(bar).toBeVisible();
  const parts: [string, Locator][] = [
    ['pause', page.getByTestId('time-pause')],
    ['slider', page.getByTestId('time-slider')],
    ['value', page.getByTestId('time-scale-value')],
    ['log toggle', bar.locator('label').filter({ has: page.getByTestId('time-log-mode') })],
  ];
  const ys: number[] = [];
  for (const [what, loc] of parts) {
    await expect(loc, what).toBeVisible();
    ys.push(centreY((await loc.boundingBox())!));
  }
  expect(Math.max(...ys) - Math.min(...ys), JSON.stringify(ys)).toBeLessThanOrEqual(4);
});

// --- zone labels inside the System View left panel tiles ------------------------------

for (const lang of ['en', 'it', 'de'] as const) {
  test(`Proxima Cen left panel (${lang}): appmag zone labels lie inside the tile`, async ({
    page,
  }) => {
    await serveFixtureData(page);
    await openApp(page, lang);
    await enterAnchoredSystem(page, 'proxima cen', 'Proxima Cen');
    const tile = page.getByTestId('system-star-panel').getByTestId('stat-appmag');
    await expect(tile).toBeVisible();
    const t = (await tile.boundingBox())!;
    const labels = tile.locator('[data-gauge-label="zone"]').filter({ hasText: /\S/ });
    const n = await labels.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      const b = (await labels.nth(i).boundingBox())!;
      const what = `${lang} zone label ${i}: ${JSON.stringify([b, t])}`;
      expect(b.x, what).toBeGreaterThanOrEqual(t.x - 0.5);
      expect(b.x + b.width, what).toBeLessThanOrEqual(t.x + t.width + 0.5);
    }
  });
}

// --- a planet without an orbit opens its card without the unfold delay -----------------

test('planet without pl_orbsmax: the card is fully shown within 400 ms of the click', async ({
  page,
}) => {
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const pl = d.hosts['TRAPPIST-1']!.planets.find((q) => q['pl_name'] === 'TRAPPIST-1 b')!;
    pl['pl_orbsmax'] = null;
  });
  await openApp(page);
  await enterTrappist(page);
  await page.waitForTimeout(500);
  await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid="planet-panel"]');
          return el ? getComputedStyle(el).opacity : 'missing';
        }),
      { timeout: 400 },
    )
    .toBe('1');
});
