/**
 * Issue #25 (spec §4.5): on touch devices the welcome guide lists touch
 * commands instead of mouse/keyboard ones, and the dialog fits phone viewports.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

// Start from a clean profile: the global config pre-dismisses the dialog.
test.use({ storageState: { cookies: [], origins: [] } });

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

const dialog = (page: Page) => page.getByTestId('welcome-dialog');

test('guide lists touch commands and no keyboard keys', async ({ page }) => {
  await openApp(page);
  await expect(dialog(page)).toBeVisible();
  // en welcome.guide.touch.look
  await expect(dialog(page)).toContainText('Drag with one finger');
  await expect(dialog(page).locator('kbd')).toHaveCount(0);
});

test('Start exploring is at least 44 px tall', async ({ page }) => {
  await openApp(page);
  const box = await page.getByTestId('welcome-start').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

for (const size of [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
]) {
  test(`dialog fits the viewport at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openApp(page);
    await expect(dialog(page)).toBeVisible();
    const box = await dialog(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
  });
}
