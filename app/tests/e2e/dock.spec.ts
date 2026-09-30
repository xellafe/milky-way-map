/**
 * Bottom control dock gathers Filters/View/Options/Music
 * into one icon row, one panel open at a time. Esc closes the open panel and
 * returns focus to its icon. Music keeps playing across panel open/close and
 * View changes (the <audio> element is mounted outside any panel); the
 * autoplay-on-first-gesture fallback must not fight an explicit first click
 * on the music icon.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

test('dock: one panel open at a time, Esc closes and restores focus', async ({ page }) => {
  await openApp(page);

  const filtersToggle = page.getByTestId('filters-toggle');
  const optionsToggle = page.getByTestId('options-toggle');

  await filtersToggle.click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
  await expect(filtersToggle).toHaveAttribute('aria-expanded', 'true');

  await optionsToggle.click();
  await expect(page.getByTestId('options-panel')).toBeVisible();
  await expect(page.getByTestId('filters-panel')).toHaveCount(0);
  await expect(optionsToggle).toHaveAttribute('aria-expanded', 'true');

  // Clicking the icon already focuses it: move focus into the panel so the
  // assertion below proves Esc restores it.
  await page.getByTestId('option-moveSpeedLyPerS').focus();
  await expect(optionsToggle).not.toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('options-panel')).toHaveCount(0);
  await expect(page.getByTestId('filters-panel')).toHaveCount(0);
  await expect(optionsToggle).toBeFocused();
});

test('dock: music keeps playing across panel close and System View entry', async ({ page }) => {
  await openApp(page);

  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);
  const musicIcon = page.getByTestId('music-toggle-panel');

  await musicIcon.click();
  await expect(page.getByTestId('music-control')).toBeVisible();
  await page.getByTestId('music-toggle').click();
  await expect.poll(paused).toBe(false);

  await musicIcon.click();
  await expect(page.getByTestId('music-control')).toHaveCount(0);
  expect(await paused()).toBe(false);

  await page.getByTestId('search-input').fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await page.getByTestId('view-system-button').click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  expect(await paused()).toBe(false);
});

test('dock: first gesture on the music icon does not race the autoplay fallback', async ({
  page,
}) => {
  await openApp(page);
  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);

  await page.getByTestId('music-toggle-panel').click();
  expect(await paused()).toBe(true);
});

test('dock: first gesture on another dock icon still starts the music', async ({ page }) => {
  await openApp(page);
  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);

  await page.getByTestId('filters-toggle').click();
  await expect.poll(paused).toBe(false);
});
