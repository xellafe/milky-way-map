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

// #8: auto-orbit speed slider.
test('auto-orbit speed: disabled when off, persists, reset to 2', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  const slider = page.getByTestId('option-autoOrbitSpeedDegPerS');
  await expect(slider).toBeEnabled();
  await expect(slider).toHaveValue('2');

  await slider.fill('6');
  await page.getByTestId('option-autoOrbit').uncheck();
  await expect(slider).toBeDisabled();
  await page.getByTestId('option-autoOrbit').check();
  await expect(slider).toBeEnabled();

  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('option-autoOrbitSpeedDegPerS')).toHaveValue('6');

  await page.getByTestId('options-reset').click();
  await expect(page.getByTestId('option-autoOrbitSpeedDegPerS')).toHaveValue('2');
});

// #9: star color saturation slider.
test('star color saturation: realism disables, persists, reset to 2.5', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  const slider = page.getByTestId('option-starColorSaturation');
  await expect(slider).toBeEnabled();
  await expect(slider).toHaveValue('2.5');

  await page.getByTestId('option-realism').check();
  await expect(slider).toBeDisabled();
  await page.getByTestId('option-realism').uncheck();
  await expect(slider).toBeEnabled();

  await slider.fill('3.5');
  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('option-starColorSaturation')).toHaveValue('3.5');

  await page.getByTestId('options-reset').click();
  await expect(page.getByTestId('option-starColorSaturation')).toHaveValue('2.5');
});

// #23 B2: in the System View realism and star color saturation have an effect.
test('System View options: realism + saturation, no reset; galaxy options unchanged', async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  for (const id of [
    'option-realism',
    'option-moveSpeedLyPerS',
    'option-autoOrbit',
    'option-autoOrbitSpeedDegPerS',
    'option-twinkleSpeed',
    'option-twinkleAmplitude',
    'option-sizeGamma',
    'option-starColorSaturation',
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
  const sysSat = page.getByTestId('option-starColorSaturation');
  await expect(sysSat).toBeVisible();
  await expect(sysSat).toBeEnabled();
  await page.getByTestId('option-realism').check();
  await expect(sysSat).toBeDisabled();
  await page.getByTestId('option-realism').uncheck();
  for (const id of [
    'option-moveSpeedLyPerS',
    'option-autoOrbit',
    'option-autoOrbitSpeedDegPerS',
    'option-twinkleSpeed',
    'option-twinkleAmplitude',
    'option-sizeGamma',
    'options-reset',
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
});

// #9 follow-up: the setting reaches the galaxy cloud's uColorGamma (AC1).
test('star color saturation reaches the cloud gamma; realism forces 1', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  const readGamma = () =>
    page.evaluate(
      () =>
        ((globalThis as Record<string, unknown>).__starCloud as { colorGamma: number } | undefined)
          ?.colorGamma,
    );
  await page.getByTestId('options-toggle').click();
  await page.getByTestId('option-starColorSaturation').fill('3.5');
  await expect.poll(readGamma).toBe(3.5);
  await page.getByTestId('option-realism').check();
  await expect.poll(readGamma).toBe(1);
});
