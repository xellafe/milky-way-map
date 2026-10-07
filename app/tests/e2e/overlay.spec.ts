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

test('Polaris via search: overlay with distance card, no System View button', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');

  await expect(overlay(page)).toHaveCSS('visibility', 'visible');
  const card = page.getByTestId('selection-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('stat-distance')).toContainText(
    `${enNumber(polarisDistanceLy(), 1)} ly`,
  );
  await expect(page.getByTestId('view-system-button')).toHaveCount(0);
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
  // orbit lock while the selection stays (card still mounted).
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(100);
  await page.keyboard.up('KeyS');
  await expect(page.getByTestId('selection-card')).toBeVisible();

  await yaw(page, Math.PI);
  await expect(overlay(page)).toHaveCSS('visibility', 'hidden');
  await expect(page.getByTestId('selection-card')).toBeAttached();

  // Turning back brings it into view again.
  await yaw(page, -Math.PI);
  await expect(overlay(page)).toHaveCSS('visibility', 'visible');
});

// #23: the card is the only star UI, so closing it deselects the star.
test('overlay-close removes overlay and card within 1 s (closing deselects)', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await expect(overlay(page)).toBeAttached();

  await page.getByTestId('overlay-close').click();
  await expect(overlay(page)).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
});

test('Escape deselects the star (card closes)', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await expect(page.getByTestId('selection-card')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('selection-card')).toHaveCount(0, { timeout: 1000 });
});

test('Escape closes the dock panel first, the next one deselects', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('filters-panel')).toHaveCount(0);
  await expect(page.getByTestId('selection-card')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('selection-card')).toHaveCount(0, { timeout: 1000 });
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

test('clicking the same star again after closing selects it again', async ({ page }) => {
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await waitForFlyToArrival(page);
  await page.getByTestId('overlay-close').click();
  await expect(overlay(page)).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByTestId('selection-card')).toHaveCount(0);

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

test('card stays in the usable area: below the search, above the bottom stack (Proxima Cen)', async ({
  page,
}) => {
  await openApp(page);
  await selectBySearch(page, 'proxima', 'Proxima');
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('view-system-button')).toBeVisible();

  const card = (await page.getByTestId('selection-card').boundingBox())!;
  const search = (await page.locator('[data-hud=search]').boundingBox())!;
  const stack = (await page.locator('[data-hud=bottom-stack]').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(card.y).toBeGreaterThanOrEqual(search.y + search.height);
  expect(card.y + card.height).toBeLessThanOrEqual(stack.y);
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(vp.width);
});

test('card stays in the usable area with the Filters panel open and Advanced mode on', async ({
  page,
}) => {
  await openApp(page);
  await selectBySearch(page, 'proxima', 'Proxima');
  await waitForFlyToArrival(page);
  await page.getByTestId('card-mode-advanced').click();
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
  await page.waitForTimeout(400);

  const card = (await page.getByTestId('selection-card').boundingBox())!;
  const search = (await page.locator('[data-hud=search]').boundingBox())!;
  const stack = (await page.locator('[data-hud=bottom-stack]').boundingBox())!;
  expect(card.y).toBeGreaterThanOrEqual(search.y + search.height);
  expect(card.y + card.height).toBeLessThanOrEqual(stack.y);
});

test('prefers-reduced-motion: switching to Advanced runs no animation on the card', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await selectBySearch(page, 'polaris', 'Polaris');
  await expect(page.getByTestId('selection-card')).toBeVisible();

  await page.getByTestId('card-mode-advanced').click();
  await expect(page.getByTestId('card-advanced')).toBeVisible();
  const running = await page
    .getByTestId('selection-card')
    .evaluate((el) => el.getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
});

// #23: an unanchored host has no star to point at, so the search opens the
// System View directly; the "not anchored" badge sits in its header for now.
test('TRAPPIST-1 (unanchored host): System View opens directly, no galaxy card', async ({
  page,
}) => {
  await openApp(page);
  await selectBySearch(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await expect(page.getByTestId('not-anchored-badge')).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
});

// #23: the mode switch is animated both ways: the card widens (250 ms), then the right
// column fades in (200 ms); closing Advanced plays the reverse before unmounting it.
test.describe('card mode animation', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openApp(page);
    await selectBySearch(page, 'polaris', 'Polaris');
    await expect(page.getByTestId('selection-card')).toBeVisible();
    await page.waitForTimeout(1500); // let the opening sequence finish
  });

  // The probes run inside the page: Playwright's click() can return after the whole
  // 450 ms sequence on the slow WebGL page, so sampling from outside would be unreliable.
  test('Base to Advanced: the column fades in only after the widening', async ({ page }) => {
    const info = await page.evaluate(async () => {
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      q('card-mode-advanced')!.click();
      await new Promise((r) => requestAnimationFrame(r));
      const el = q('card-advanced');
      if (!el) return null;
      const timings = el.getAnimations().map((a) => (a.effect as KeyframeEffect).getTiming());
      return {
        opacity: parseFloat(getComputedStyle(el).opacity),
        delays: timings.map((t) => Number(t.delay)),
        mode: q('selection-card')!.getAttribute('data-mode'),
      };
    });
    expect(info).not.toBeNull();
    expect(info!.delays.some((d) => d >= 250) || info!.opacity < 1).toBe(true);
    await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'advanced');
  });

  test('Advanced to Base: animates out, then unmounts the column', async ({ page }) => {
    await page.getByTestId('card-mode-advanced').click();
    await expect(page.getByTestId('card-advanced')).toBeVisible();
    await page.waitForTimeout(800);

    const during = await page.evaluate(async () => {
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const card = q('selection-card')!;
      q('card-mode-base')!.click();
      await new Promise((r) => requestAnimationFrame(r));
      return {
        animations: card.getAnimations({ subtree: true }).length,
        columnAttached: !!card.querySelector('[data-testid="card-advanced"]'),
        mode: card.getAttribute('data-mode'),
      };
    });
    expect(during.animations).toBeGreaterThan(0);
    expect(during.columnAttached).toBe(true);
    expect(during.mode).toBe('advanced');

    const card = page.getByTestId('selection-card');
    await expect(card).toHaveAttribute('data-mode', 'base', { timeout: 2000 });
    await expect(page.getByTestId('card-advanced')).toHaveCount(0, { timeout: 2000 });
  });
});
