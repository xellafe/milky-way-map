/**
 * #36 / SPEC §10: a failed secondary data file surfaces an error instead of
 * loading forever, and a later request retries it without a page reload.
 * #38: a corrupt star manifest has its own message, distinct from network errors.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));
const DETAIL_ATTRIBUTES = ['distanceLy', 'appMag', 'absMag', 'colorIndex', 'luminosity'];
const NAMES_INDEX = '**/data/names.index.json';
const EXOPLANETS = '**/data/exoplanets.json';

/** Byte ranges of the detail sections in the golden stars.bin. */
function detailRanges(): [number, number][] {
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { attributes: { name: string; byteOffset: number; byteLength: number }[] };
  return manifest.attributes
    .filter((a) => DETAIL_ATTRIBUTES.includes(a.name))
    .map((a) => [a.byteOffset, a.byteOffset + a.byteLength]);
}

const fail = (route: { fulfill: (r: { status: number; body: string }) => Promise<void> }) =>
  route.fulfill({ status: 500, body: 'boom' });

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function failDetailSections(page: Page): Promise<void> {
  const ranges = detailRanges();
  // Registered after serveFixtureData: the last matching route wins.
  await page.route('**/data/stars.bin', async (route) => {
    const m = /bytes=(\d+)-/.exec(route.request().headers()['range'] ?? '');
    const start = m ? Number(m[1]) : -1;
    if (ranges.some(([lo, hi]) => start >= lo && start < hi)) await fail(route);
    else await route.fallback();
  });
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function searchFor(page: Page, query: string): Promise<void> {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill(query);
}

test('search shows an error, then retries on refocus without a reload', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await serveFixtureData(page);
  await page.route(NAMES_INDEX, fail);
  await page.route(EXOPLANETS, fail);
  await openApp(page);

  await searchFor(page, 'sol');
  const results = page.getByTestId('search-results');
  await expect(results).toContainText(/could not load the search data/i);
  await expect(results).not.toContainText('Loading…');

  await page.unroute(NAMES_INDEX);
  await page.unroute(EXOPLANETS);
  await page.getByTestId('search-input').blur();
  await page.getByTestId('search-input').focus();
  await expect(page.getByRole('option').filter({ hasText: 'Sol' }).first()).toBeVisible();
  await expect(results).not.toContainText(/could not load/i);
  expect(pageErrors).toEqual([]);
});

test('filters panel reports failed detail sections; sliders stay disabled', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await serveFixtureData(page);
  await failDetailSections(page);
  await openApp(page);
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-error')).toContainText(/could not load/i);
  for (const id of ['distance', 'appmag', 'absmag']) {
    await expect(page.getByTestId(`filter-${id}-min-slider`)).toBeDisabled();
    await expect(page.getByTestId(`filter-${id}-max-slider`)).toBeDisabled();
  }
  expect(pageErrors).toEqual([]);
});

test('a corrupt manifest shows the damaged-catalog message without fetching stars.bin', async ({
  page,
}) => {
  await serveFixtureData(page);
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { attributes: { name: string; byteLength: number }[] };
  manifest.attributes.find((a) => a.name === 'position')!.byteLength -= 4;
  await page.route('**/data/stars.manifest.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(manifest),
    }),
  );
  const binRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/stars.bin')) binRequests.push(request.url());
  });

  await page.goto('/');
  const overlay = page.getByTestId('loading-overlay');
  await expect(overlay).toHaveText('The star catalog is damaged and cannot be displayed.');
  expect(binRequests).toEqual([]);

  const results = await new AxeBuilder({ page }).exclude('canvas').analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test('a network failure keeps the load-failed message, not the damaged one', async ({ page }) => {
  await serveFixtureData(page);
  await page.route('**/data/stars.manifest.json', fail);
  await page.goto('/');
  const overlay = page.getByTestId('loading-overlay');
  await expect(overlay).toContainText(/could not load the star catalog/i);
  await expect(overlay).not.toContainText(/damaged/i);
});

test('loader error messages have no blocking axe violations', async ({ page }) => {
  await serveFixtureData(page);
  await failDetailSections(page);
  await page.route(NAMES_INDEX, fail);
  await page.route(EXOPLANETS, fail);
  await openApp(page);

  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-error')).toBeVisible();
  await searchFor(page, 'sol');
  await expect(page.getByTestId('search-error')).toBeVisible();

  const results = await new AxeBuilder({ page }).exclude('canvas').analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
