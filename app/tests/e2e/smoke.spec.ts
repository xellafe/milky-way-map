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

// Regression guard: component CSS must stay layered so Tailwind position
// utilities win (any unlayered rule beats @layer utilities regardless of source
// order). A violation pushes HUD panels off-screen while they still exist in the
// DOM, so a mere .toBeVisible()/testid presence check doesn't catch it.
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

  // view-toggles only exist while their dock panel is open, so check
  // the dock icons, the always-visible music controls plus one open panel.
  await expectInsideViewport('filters-toggle');
  await expectInsideViewport('view-toggle');
  await expectInsideViewport('options-toggle');
  await expectInsideViewport('music-control');
  await expectInsideViewport('language-button');

  await page.getByTestId('options-toggle').click();
  await expectInsideViewport('options-panel');

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expectInsideViewport('star-panel');
});
