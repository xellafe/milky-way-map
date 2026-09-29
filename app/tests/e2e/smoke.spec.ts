import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

// M0 acceptance: the app builds and the scene (solid black background) renders.
test('renders the scene without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await serveFixtureData(page);

  await page.goto('/');
  await expect(page).toHaveTitle('Galaxy Map');

  // WebGL2 canvas mounted and visible (no fallback alert shown).
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

// Regression guard (Task 1.2 fix round 1): .hud-panel was unlayered CSS and its
// `position: relative` beat Tailwind's `absolute` utility (utilities live in
// @layer utilities, and any unlayered rule wins over @layer regardless of source
// order), pushing every HUD panel off-screen while still existing in the DOM —
// so a mere .toBeVisible()/testid presence check didn't catch it.
test('HUD panels stay positioned inside the viewport', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport size');

  const expectInsideViewport = async (testId: string) => {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} has no bounding box`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeLessThan(viewport.width);
    expect(box!.y).toBeLessThan(viewport.height);
  };

  await expectInsideViewport('view-toggles');
  await expectInsideViewport('music-control');
  await expectInsideViewport('options-toggle');
  await expectInsideViewport('language-button');
  await expectInsideViewport('filters-toggle');

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expectInsideViewport('star-panel');
});
