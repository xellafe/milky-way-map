/**
 * M3 acceptance: selecting Polaris (via search AND via click) and TRAPPIST-1
 * (via search — it is NOT in the cloud: matched:false, SPEC §5.3) shows
 * correct data. Expected values are read from the golden fixture itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

interface FixtureStar {
  index: number;
  distanceLy: number;
  appMag: number;
  spectralClass: number;
  luminosity: number;
}

function readFixtureStar(properName: string): FixtureStar {
  const names = JSON.parse(
    readFileSync(path.join(FIXTURES, 'names.index.json'), 'utf-8'),
  ) as Record<string, { proper?: string }>;
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { count: number; attributes: { name: string; byteOffset: number }[] };
  const entry = Object.entries(names).find(([, e]) => e.proper === properName);
  if (!entry) throw new Error(`${properName} not in fixture`);
  const index = Number(entry[0]);

  const bin = readFileSync(path.join(FIXTURES, 'stars.bin'));
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const attr = (name: string) => manifest.attributes.find((a) => a.name === name)!;
  const f32 = (name: string) => new Float32Array(buf, attr(name).byteOffset, manifest.count);
  const u8 = (name: string) => new Uint8Array(buf, attr(name).byteOffset, manifest.count);

  return {
    index,
    distanceLy: f32('distanceLy')[index]!,
    appMag: f32('appMag')[index]!,
    spectralClass: u8('spectralClass')[index]!,
    luminosity: f32('luminosity')[index]!,
  };
}

const SPECTRAL = 'OBAFGKM';
const enNumber = (v: number, digits: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v);
const enSignificant = (v: number, digits: number) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(v);

test('Polaris via search shows correct catalog data', async ({ page }) => {
  const polaris = readFixtureStar('Polaris');
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();

  const panel = page.getByTestId('star-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
  await expect(panel).toContainText(`${enNumber(polaris.distanceLy, 1)} ly`);
  await expect(panel).toContainText(enNumber(polaris.appMag, 2));
  await expect(panel).toContainText(SPECTRAL[polaris.spectralClass]!);
});

test('Polaris panel: four stat tiles with gauges, no planets UI', async ({ page }) => {
  const polaris = readFixtureStar('Polaris');
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();

  // Scoped to the panel: the selection overlay (#3) renders the same stat tiles.
  const panel = page.getByTestId('star-panel');
  const tile = (id: string) => panel.getByTestId(id);
  await expect(tile('stat-distance')).toBeVisible();
  await expect(tile('stat-distance')).toContainText(`${enNumber(polaris.distanceLy, 1)} ly`);
  await expect(tile('stat-teff')).toBeVisible();
  await expect(tile('stat-teff')).toContainText(/≈\s*[\d,]+\s*K/);
  await expect(tile('stat-teff')).toContainText(/estimate/i);
  await expect(tile('stat-luminosity')).toBeVisible();
  await expect(tile('stat-luminosity')).toContainText(enSignificant(polaris.luminosity, 3));
  await expect(tile('stat-appmag')).toBeVisible();
  await expect(tile('stat-appmag')).toContainText(enNumber(polaris.appMag, 2));

  // Each tile exposes its gauge as a meter with a text alternative.
  for (const id of ['stat-distance', 'stat-teff', 'stat-luminosity', 'stat-appmag']) {
    const meter = tile(id).getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuemin', '0');
    await expect(meter).toHaveAttribute('aria-valuemax', '1');
    await expect(meter).toHaveAttribute('aria-valuenow', /^\d/);
    await expect(meter).toHaveAttribute('aria-valuetext', /\S/);
  }

  // Regression: HUD panels must not create horizontal overflow (a 1 px
  // scrollbar) in scrollable panels.
  const noHScroll = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(await noHScroll('star-panel')).toBe(true);
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
  expect(await noHScroll('filters-panel')).toBe(true);

  // Polaris has no known planets: no badge, no System View button.
  await expect(panel.getByTestId('planets-badge')).toHaveCount(0);
  await expect(panel.getByTestId('view-system-button')).toHaveCount(0);
});

test('catalog-anchored host (Proxima Cen) shows planets badge and System View button', async ({
  page,
}) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('proxima cen');
  await page.getByRole('option').filter({ hasText: 'Proxima Cen' }).first().click();

  const panel = page.getByTestId('star-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('stat-distance')).toBeVisible();
  await expect(panel.getByTestId('planets-badge')).toBeVisible();
  await expect(panel.getByTestId('planets-badge')).toContainText('2');
  await expect(panel.getByTestId('view-system-button')).toBeVisible();
});

test('Polaris via click (after fly-to centers it) shows the same panel', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Fly to Polaris via search, then deselect: the star stays screen-centered.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('panel-close').click();
  await expect(page.getByTestId('star-panel')).toHaveCount(0);
  await waitForFlyToArrival(page);

  // Click the canvas center → GPU picking must select Polaris.
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByTestId('star-panel')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

test('TRAPPIST-1 via search: unanchored host with 7 planets', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const input = page.getByTestId('search-input');
  await input.click(); // focus triggers the lazy exoplanets.json load
  await input.fill('trappist');
  const option = page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first();
  await expect(option).toBeVisible();
  await option.click();

  const panel = page.getByTestId('star-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('TRAPPIST-1');
  await expect(page.getByTestId('not-anchored-badge')).toBeVisible();
  await expect(page.getByTestId('planet-list').locator('li')).toHaveCount(7);
  await expect(panel).toContainText('TRAPPIST-1 b');
  await expect(panel).toContainText('TRAPPIST-1 h');
  // Host star temperature from pscomppars (fixture: 2566 K).
  await expect(panel).toContainText('2,566 K');
  // Since M7 the System View button is live (system.spec.ts covers the view).
  await expect(page.getByTestId('view-system-button')).toBeEnabled();
});

test('hovering a star shows its name label', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Center Polaris, then hover the canvas center.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('panel-close').click();
  await waitForFlyToArrival(page);

  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveText('Polaris', { timeout: 5_000 });
});

// Issue #3: a click on empty sky keeps the current selection (only ✕ closes the card).
test('clicking empty sky keeps the selection (card and panel stay)', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();

  // Left-middle of the viewport: away from Polaris (centered), the panel,
  // the card, the search box and the dock. Precondition: no star hovered there.
  await page.mouse.move(250, 400);
  await page.waitForTimeout(400);
  await expect(page.getByTestId('hover-label')).toHaveCount(0);

  await page.mouse.click(250, 400);
  await page.waitForTimeout(600);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('star-panel')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});
