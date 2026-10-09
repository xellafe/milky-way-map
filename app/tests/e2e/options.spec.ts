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

// #23 B2: in the System View only realism has an effect.
test('System View options: realism only, no reset; galaxy options unchanged', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  for (const id of [
    'option-realism',
    'option-moveSpeedLyPerS',
    'option-autoOrbit',
    'option-twinkleSpeed',
    'option-twinkleAmplitude',
    'option-sizeGamma',
    'options-reset',
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.getByTestId('options-toggle').click();

  await page.getByTestId('search-input').fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('option-realism')).toBeVisible();
  for (const id of [
    'option-moveSpeedLyPerS',
    'option-autoOrbit',
    'option-twinkleSpeed',
    'option-twinkleAmplitude',
    'option-sizeGamma',
    'options-reset',
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
});
