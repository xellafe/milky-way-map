/** #39 regression: corrupt persisted settings are corrected silently on load. */
import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

test('corrupt persisted settings rehydrate to valid values', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await serveFixtureData(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      'galaxy-map-settings',
      JSON.stringify({
        state: { moveSpeedLyPerS: 1000, twinkleSpeed: 'x', orbitStyle: 'bogus' },
        version: 1,
      }),
    ),
  );
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('option-moveSpeedLyPerS')).toHaveValue('200');
  const twinkle = Number(await page.getByTestId('option-twinkleSpeed').inputValue());
  expect(twinkle).toBeCloseTo(2 / 3, 1);
  expect(errors).toEqual([]);
});
