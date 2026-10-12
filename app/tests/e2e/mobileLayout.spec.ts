/** #25: the phone layout mode follows viewport orientation on a coarse pointer. */
import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

test.beforeEach(async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
});

test('mobile project emulates a coarse primary pointer', async ({ page }) => {
  const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
  expect(coarse).toBe(true);
});

test('data-layout follows the viewport orientation', async ({ page }) => {
  const root = page.locator('[data-layout]');
  await expect(root).toHaveAttribute('data-layout', 'portrait');
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(root).toHaveAttribute('data-layout', 'landscape');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(root).toHaveAttribute('data-layout', 'portrait');
});
