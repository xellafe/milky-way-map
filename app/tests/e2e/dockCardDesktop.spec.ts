/**
 * Issue #25 regression: on desktop the star card stays visible while a dock
 * panel or the music player is open (the sheet's content gate is phone-only).
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

test.use({ viewport: { width: 1280, height: 720 } });

async function selectPolaris(page: Page) {
  await serveFixtureData(page);
  await page.addInitScript(() => localStorage.setItem('galaxy-map-music-collapsed', '1'));
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();
}

test('the selection card stays visible with a dock panel open', async ({ page }) => {
  await selectPolaris(page);
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
  await expect(page.getByTestId('selection-card')).toBeVisible();
});

test('the selection card stays visible with the music player expanded', async ({ page }) => {
  await selectPolaris(page);
  await page.getByTestId('music-expand').click();
  await expect(page.getByTestId('music-toggle')).toBeVisible();
  await expect(page.getByTestId('selection-card')).toBeVisible();
});
