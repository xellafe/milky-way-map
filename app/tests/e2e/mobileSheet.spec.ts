/**
 * Issue #25 (spec §4.1, §4.2, §4.4): on phones the star card lives in a single
 * bottom (portrait) / right (landscape) sheet. Uses the ?pdb=1 camera bridge.
 *
 * Star-vs-sheet check: the selected star is projected from window.__camera
 * (the selection ring is desktop-only and not rendered on phones).
 */
import { expect, test, type Page } from '@playwright/test';
import * as THREE from 'three';
import { serveFixtureData } from './fixtures';
import {
  dragHandle,
  expectHudInViewport,
  fixtureStarPosition,
  frames,
  select,
} from './mobileHelpers';

async function open(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await frames(page, 3);
}

const sheetBox = async (page: Page) => (await page.getByTestId('mobile-sheet').boundingBox())!;

for (const [name, size] of [
  ['portrait', { width: 375, height: 812 }],
  ['landscape', { width: 812, height: 375 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport: size });

    test('selecting Polaris opens the sheet at base with the card title', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      await expect(page.getByTestId('mobile-sheet').getByTestId('panel-title')).toHaveText(
        'Polaris',
      );
      const box = await sheetBox(page);
      if (name === 'portrait') {
        expect(box.width).toBeGreaterThanOrEqual(size.width - 1);
        expect(box.y + box.height).toBeGreaterThanOrEqual(size.height - 1);
        expect(box.y).toBeGreaterThan(size.height * 0.5);
      } else {
        expect(box.x + box.width).toBeGreaterThanOrEqual(size.width - 1);
        expect(box.width).toBeLessThanOrEqual(size.width * 0.5 + 1);
        expect(box.height).toBeGreaterThanOrEqual(size.height - 1);
      }
    });

    test('a star with planets also shows the system button', async ({ page }) => {
      await open(page);
      await select(page, 'proxima cen', 'Proxima');
      await expect(
        page.getByTestId('mobile-sheet').getByTestId('view-system-button'),
      ).toBeVisible();
    });

    test('the handle toggles base and expanded and reveals the Advanced column', async ({
      page,
    }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      await expect(page.getByTestId('card-advanced')).toHaveCount(0);

      await page.getByTestId('sheet-handle').click();
      await expect(sheet).toHaveAttribute('data-snap', 'expanded');
      await expect(page.getByTestId('card-advanced')).toBeVisible();

      await page.getByTestId('sheet-handle').click();
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await expect(page.getByTestId('card-advanced')).toHaveCount(0);
    });

    test('Escape on the handle closes the sheet without deselecting', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      const handle = page.getByTestId('sheet-handle');
      await expect(handle).toHaveAttribute('aria-expanded', 'true');
      const contentId = await handle.getAttribute('aria-controls');
      expect(contentId).toBeTruthy();
      await expect(sheet.locator(`[id="${contentId}"]`)).toHaveCount(1);

      await handle.focus();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await expect(handle).toBeFocused();
      await expect(handle).toHaveAttribute('aria-expanded', 'false');
      await expect(handle).not.toHaveAttribute('aria-controls');

      await page.keyboard.press('Escape');
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await expect(sheet).toHaveCount(1);
      await expect(handle).toBeFocused();
    });

    test('Escape on the handle keeps the dock panel open', async ({ page }) => {
      await open(page);
      await page.getByTestId('filters-toggle').click();
      const sheet = page.getByTestId('mobile-sheet');
      await expect(sheet.getByTestId('dock-panel')).toBeVisible();
      const handle = page.getByTestId('sheet-handle');
      await handle.focus();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await page.keyboard.press('Enter');
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await expect(sheet.getByTestId('dock-panel')).toBeVisible();
    });

    test('arrow keys on the handle step the snaps', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      const handle = page.getByTestId('sheet-handle');
      const grow = name === 'portrait' ? 'ArrowUp' : 'ArrowLeft';
      const shrink = name === 'portrait' ? 'ArrowDown' : 'ArrowRight';
      const other = name === 'portrait' ? 'ArrowLeft' : 'ArrowUp';
      await handle.focus();

      await page.keyboard.press(other);
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await page.keyboard.press(grow);
      await expect(sheet).toHaveAttribute('data-snap', 'expanded');
      await page.keyboard.press(grow);
      await expect(sheet).toHaveAttribute('data-snap', 'expanded');
      await expect(handle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press(shrink);
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await page.keyboard.press(shrink);
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await page.keyboard.press(shrink);
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await page.keyboard.press(grow);
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await expect(handle).toBeFocused();
    });

    test('Enter and Space on the handle toggle base and expanded', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      await page.getByTestId('sheet-handle').focus();
      await page.keyboard.press('Enter');
      await expect(sheet).toHaveAttribute('data-snap', 'expanded');
      await page.keyboard.press('Space');
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await page.keyboard.press('Enter');
      await expect(sheet).toHaveAttribute('data-snap', 'base');
    });

    test('Escape outside the handle still deselects', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('mobile-sheet')).toHaveCount(0);
    });

    test('closing the card removes the sheet', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      await page.getByTestId('overlay-close').click();
      await expect(page.getByTestId('mobile-sheet')).toHaveCount(0);
    });

    test('no HUD element leaves the viewport with the sheet closed, base and expanded', async ({
      page,
    }) => {
      await open(page);
      await expect(page.getByTestId('mobile-sheet')).toHaveCount(0);
      await expectHudInViewport(page);
      await select(page, 'polaris', 'Polaris');
      await expectHudInViewport(page);
      await page.getByTestId('sheet-handle').click();
      await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'expanded');
      await expectHudInViewport(page);
      await page.getByTestId('sheet-handle').click();
      await dragHandle(
        page,
        name === 'portrait' ? size.width / 2 : size.width - 2,
        size.height - 1,
      );
      await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'closed');
      await frames(page);
      await expectHudInViewport(page);
    });

    test('dragging the handle toward the free edge closes, back toward the scene opens', async ({
      page,
    }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      const close: [number, number] =
        name === 'portrait' ? [size.width / 2, size.height - 1] : [size.width - 2, size.height / 2];
      await dragHandle(page, ...close);
      await expect(sheet).toHaveAttribute('data-snap', 'closed');
      await page.getByTestId('sheet-handle').click();
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      const far: [number, number] =
        name === 'portrait' ? [size.width / 2, 20] : [20, size.height / 2];
      await dragHandle(page, ...far);
      await expect(sheet).toHaveAttribute('data-snap', 'expanded');
    });

    test('the selected star is not hidden behind the sheet once the fly-to ends', async ({
      page,
    }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const pose = (await page.evaluate(
        () => (globalThis as Record<string, unknown>).__camera,
      )) as {
        position: [number, number, number];
        quaternion: [number, number, number, number];
        viewOffset?: { x: number; y: number };
      };
      const offset = pose.viewOffset ?? { x: 0, y: 0 };
      // Same fov/near/far as GalaxyScene's camera. A view offset of +x moves the scene left.
      const cam = new THREE.PerspectiveCamera(60, size.width / size.height, 0.1, 2_000_000);
      cam.position.set(...pose.position);
      cam.quaternion.set(...pose.quaternion);
      cam.updateMatrixWorld(true);
      const ndc = fixtureStarPosition('Polaris').project(cam);
      const star = {
        x: ((ndc.x + 1) / 2) * size.width - offset.x,
        y: ((1 - ndc.y) / 2) * size.height - offset.y,
      };
      const box = await sheetBox(page);
      const clearance = 16; // px, aesthetic choice (not data)
      const outside =
        star.x <= box.x - clearance ||
        star.x >= box.x + box.width + clearance ||
        star.y <= box.y - clearance ||
        star.y >= box.y + box.height + clearance;
      expect(
        outside,
        `star at ${star.x},${star.y} (offset ${JSON.stringify(offset)}) vs sheet ${JSON.stringify(box)}`,
      ).toBe(true);
    });
  });
}

test('rotating the phone keeps the snap and moves the sheet to the right', async ({ page }) => {
  await open(page);
  await select(page, 'polaris', 'Polaris');
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'landscape');
  await frames(page);

  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  expect((await sheetBox(page)).x).toBeGreaterThanOrEqual(406);
  await expectHudInViewport(page);
});
