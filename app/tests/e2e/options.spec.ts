/**
 * Issue #1: options panel — realism disables the twinkle controls, values
 * persist across reloads (localStorage), reset restores the defaults.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

test('options: realism, persistence and reset', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  const panel = page.getByTestId('options-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('options-reset')).toBeDisabled();

  await page.getByTestId('option-realism').check();
  await expect(page.getByTestId('option-twinkleSpeed')).toBeDisabled();
  await expect(page.getByTestId('option-twinkleAmplitude')).toBeDisabled();
  await page.getByTestId('option-autoOrbit').uncheck();
  await page.getByTestId('option-moveSpeedLyPerS').fill('100');

  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('option-realism')).toBeChecked();
  await expect(page.getByTestId('option-autoOrbit')).not.toBeChecked();
  await expect(page.getByTestId('option-moveSpeedLyPerS')).toHaveValue('100');

  await page.getByTestId('options-reset').click();
  await expect(page.getByTestId('option-realism')).not.toBeChecked();
  await expect(page.getByTestId('option-autoOrbit')).toBeChecked();
  await expect(page.getByTestId('option-moveSpeedLyPerS')).toHaveValue('25');
  await expect(page.getByTestId('options-reset')).toBeDisabled();
});
