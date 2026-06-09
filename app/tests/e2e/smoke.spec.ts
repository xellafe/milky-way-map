import { expect, test } from '@playwright/test';

// M0 acceptance: the app builds and an empty scene (solid black background) renders.
test('renders the empty black scene without errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle('Galaxy Map');

  // WebGL2 canvas mounted and visible (no fallback alert shown).
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
