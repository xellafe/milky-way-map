/**
 * Issue #25 (spec §6, AC11): axe finds no serious/critical violations on phone
 * viewports. Same configuration as a11y.spec.ts (the 3D canvas is excluded,
 * SPEC §6.9). The scene runs at a few fps in software rendering: wait on rAF frames.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';
import { frames, search } from './mobileHelpers';

async function open(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await frames(page, 3);
}

async function selectPolaris(page: Page) {
  await search(page, 'polaris', 'Polaris');
  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  await waitForFlyToArrival(page);
  await frames(page);
}

async function scan(page: Page) {
  await frames(page);
  const results = await new AxeBuilder({ page }).exclude('canvas').analyze();
  const violations = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

for (const size of [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
]) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('empty galaxy has no blocking axe violations', async ({ page }) => {
      await open(page);
      await scan(page);
    });

    test('selected star at base has no blocking axe violations', async ({ page }) => {
      await open(page);
      await selectPolaris(page);
      await scan(page);
    });

    test('selected star expanded has no blocking axe violations', async ({ page }) => {
      await open(page);
      await selectPolaris(page);
      await page.getByTestId('sheet-handle').click();
      await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'expanded');
      await expect(page.getByTestId('card-advanced')).toBeVisible();
      await scan(page);
    });

    test('open dock panel has no blocking axe violations', async ({ page }) => {
      await open(page);
      await page.getByTestId('filters-toggle').click();
      await expect(page.getByTestId('mobile-sheet').getByTestId('dock-panel')).toBeVisible();
      await scan(page);
    });

    test('System View with a selected planet has no blocking axe violations', async ({ page }) => {
      await open(page);
      await search(page, 'trappist', 'TRAPPIST-1');
      await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
      const sheet = page.getByTestId('mobile-sheet');
      await sheet.getByTestId('sheet-tab-planets').click();
      await sheet.getByTestId('planet-chip').first().click();
      await expect(sheet.getByTestId('planet-panel')).toBeVisible();
      await scan(page);
    });
  });
}
