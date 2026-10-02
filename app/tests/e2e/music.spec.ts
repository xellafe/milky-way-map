/**
 * Background music: the play/pause toggle and volume slider drive the <audio>.
 * The controls are always visible top-right (no panel to open), and the first
 * gesture on them must not race the autoplay-on-first-gesture fallback.
 */
import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

test('music toggle plays/pauses and the slider sets the volume', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);
  await expect(page.getByTestId('music-control')).toBeVisible();
  const toggle = page.getByTestId('music-toggle');

  await toggle.click();
  await expect.poll(paused).toBe(false);
  await expect(toggle).toHaveAttribute('aria-label', 'Pause music');

  await toggle.click();
  await expect.poll(paused).toBe(true);
  await expect(toggle).toHaveAttribute('aria-label', 'Play music');

  await page.getByTestId('music-volume').fill('0.8');
  expect(await audio.evaluate((el: HTMLAudioElement) => el.volume)).toBeCloseTo(0.8);
});
