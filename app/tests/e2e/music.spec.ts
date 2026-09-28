/**
 * Background music: play/pause toggle and volume slider drive the <audio>.
 * Clicking the toggle as the very first gesture must start playback (the
 * autoplay-on-first-gesture fallback must not race it into an immediate pause).
 */
import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

test('music toggle plays/pauses and the slider sets the volume', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);
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
