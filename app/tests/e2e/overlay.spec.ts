/**
 * Issue #3 F4: selection overlay (B6 double ring + 4-value card) that follows
 * the selected star on screen. Expected values come from the golden fixture.
 * Uses the ?pdb=1 camera debug bridge (window.__camera) like camera.spec.ts.
 *
 * "Star behind the camera while selected": selecting a star locks the camera
 * in orbit, but any translation key (WASD/RF) releases the lock back to
 * free-fly WITHOUT clearing the selection (CameraControls MOVE_KEYS). Free-fly
 * drag-to-look then rotates the camera freely, so a yaw of ~180° puts the
 * still-selected star behind the camera. That is the real user path used here.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));
// Free-fly look sensitivity (CameraControls LOOK_SENSITIVITY): rad per pixel.
const LOOK_RAD_PER_PX = 0.0025;

function polarisDistanceLy(): number {
  const names = JSON.parse(
    readFileSync(path.join(FIXTURES, 'names.index.json'), 'utf-8'),
  ) as Record<string, { proper?: string }>;
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { count: number; attributes: { name: string; byteOffset: number }[] };
  const index = Number(Object.entries(names).find(([, e]) => e.proper === 'Polaris')![0]);
  const bin = readFileSync(path.join(FIXTURES, 'stars.bin'));
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const attr = manifest.attributes.find((a) => a.name === 'distanceLy')!;
  return new Float32Array(buf, attr.byteOffset, manifest.count)[index]!;
}

const enNumber = (v: number, digits: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v);

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

async function selectBySearch(page: Page, query: string, label: string) {
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: label }).first().click();
}

const overlay = (page: Page) => page.getByTestId('selection-overlay');
const transformOf = (page: Page) =>
  overlay(page).evaluate((el) => (el as HTMLElement).style.transform);

/**
 * Yaw the free-fly camera with ONE pointermove (steps:1) so it costs a single
 * frame even at ~5 fps headless. Max |radians| ~ pi (1257 px of the 1280 px viewport).
 */
async function yaw(page: Page, radians: number) {
  const d = Math.round(radians / LOOK_RAD_PER_PX);
  const startX = d > 0 ? 10 : 1270;
  await page.mouse.move(startX, 360);
  await page.mouse.down();
  await page.mouse.move(startX + d, 360, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('Polaris via search: overlay with distance card, no planets badge', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');

  await expect(overlay(page)).toHaveCSS('visibility', 'visible');
  const card = page.getByTestId('selection-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('stat-distance')).toContainText(
    `${enNumber(polarisDistanceLy(), 1)} ly`,
  );
  await expect(page.getByTestId('overlay-planets-badge')).toHaveCount(0);
});

test('overlay transform changes after a camera movement', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await waitForFlyToArrival(page);
  await expect(overlay(page)).toBeAttached();
  const before = await transformOf(page);
  expect(before).toContain('translate');

  // Strafe: releases the orbit lock and moves the star on screen.
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(150);

  expect(await transformOf(page)).not.toBe(before);
});

test('star behind the camera (selection kept) hides the overlay', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await waitForFlyToArrival(page);
  await expect(overlay(page)).toHaveCSS('visibility', 'visible');

  // Short move along the view axis (Polaris stays centered): releases the
  // orbit lock while the selection stays (star-panel still open).
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(100);
  await page.keyboard.up('KeyS');
  await expect(page.getByTestId('star-panel')).toBeVisible();

  await yaw(page, Math.PI);
  await expect(overlay(page)).toHaveCSS('visibility', 'hidden');
  await expect(page.getByTestId('star-panel')).toBeVisible();

  // Turning back brings it into view again.
  await yaw(page, -Math.PI);
  await expect(overlay(page)).toHaveCSS('visibility', 'visible');
});

test('overlay-close removes the overlay within 1 s, star panel stays', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await expect(overlay(page)).toBeAttached();

  await page.getByTestId('overlay-close').click();
  await expect(overlay(page)).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByTestId('star-panel')).toBeVisible();
});

test('re-selecting Polaris via search reopens a closed overlay', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await page.getByTestId('overlay-close').click();
  await expect(overlay(page)).toHaveCount(0, { timeout: 1000 });

  await selectBySearch(page, 'polaris', 'Polaris');
  await expect(overlay(page)).toBeAttached();
  await expect(page.getByTestId('selection-card')).toBeVisible();
});

test('clicking the SAME star again reopens a closed overlay', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await waitForFlyToArrival(page);
  await page.getByTestId('overlay-close').click();
  await expect(overlay(page)).toHaveCount(0, { timeout: 1000 });

  // After the fly-to (and orbit lock) Polaris is screen-centered.
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
  await expect(overlay(page)).toBeAttached();
});

test('prefers-reduced-motion: overlay-close removes the overlay immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await expect(overlay(page)).toBeAttached();

  await page.getByTestId('overlay-close').click();
  // No flicker animation: gone on the very next check, no waiting.
  await expect(overlay(page)).toHaveCount(0, { timeout: 300 });
});

test('card stays inside the viewport and clear of the dock (Proxima Cen)', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'proxima', 'Proxima');
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('overlay-planets-badge')).toBeVisible();

  const card = (await page.getByTestId('selection-card').boundingBox())!;
  const dock = (await page.getByTestId('dock').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(vp.height);
  expect(card.y + card.height).toBeLessThanOrEqual(dock.y);
});

test('TRAPPIST-1 (unanchored host): no overlay', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('panel-title')).toHaveText('TRAPPIST-1');
  await expect(overlay(page)).toHaveCount(0);
});
