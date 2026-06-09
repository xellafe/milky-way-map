/**
 * M3 acceptance: selecting Polaris (via search AND via click) and TRAPPIST-1
 * (via search — it is NOT in the cloud: matched:false, SPEC §5.3) shows
 * correct data. Expected values are read from the golden fixture itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

interface FixtureStar {
  index: number;
  distanceLy: number;
  appMag: number;
  spectralClass: number;
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
  };
}

const SPECTRAL = 'OBAFGKM';
const enNumber = (v: number, digits: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v);

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

test('Polaris via click (after fly-to centers it) shows the same panel', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Fly to Polaris via search, then deselect: the star stays screen-centered.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('panel-close').click();
  await expect(page.getByTestId('star-panel')).toHaveCount(0);

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
  // The System View button exists but is disabled until M7.
  await expect(page.getByTestId('view-system-button')).toBeDisabled();
});

test('hovering a star shows its name label', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Center Polaris, then hover the canvas center.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('panel-close').click();

  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveText('Polaris', { timeout: 5_000 });
});
