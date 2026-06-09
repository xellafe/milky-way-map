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
