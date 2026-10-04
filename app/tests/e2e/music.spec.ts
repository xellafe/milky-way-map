/**
 * Background music (issue #13): the bottom-right player drives the <audio>
 * (toggle, volume, prev/next, collapse/expand). The first gesture on it must
 * not race the autoplay-on-first-gesture fallback, and collapsing must never
 * interrupt playback.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

const audioOf = (page: Page) => page.getByTestId('music-audio');
const state = (page: Page) =>
  audioOf(page).evaluate((el: HTMLAudioElement) => ({
    paused: el.paused,
    currentTime: el.currentTime,
    duration: el.duration,
    loop: el.loop,
  }));

/** Plays and waits for metadata (preload="none"), so currentTime/duration are usable. */
async function startPlaying(page: Page) {
  await page.getByTestId('music-toggle').click();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
  await expect
    .poll(() => audioOf(page).evaluate((el: HTMLAudioElement) => el.readyState), {
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(1);
}

const seek = (page: Page, t: number | 'nearEnd') =>
  audioOf(page).evaluate((el: HTMLAudioElement, v) => {
    el.currentTime = v === 'nearEnd' ? el.duration - 0.5 : v;
  }, t);

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

for (const which of ['next', 'prev'] as const) {
  test(`${which} restarts the single track and keeps playing`, async ({ page }) => {
    await openApp(page);
    await startPlaying(page);
    await seek(page, 60);
    await page.getByTestId(`music-${which}`).click();
    await expect.poll(async () => (await state(page)).currentTime).toBeLessThan(10);
    expect((await state(page)).paused).toBe(false);
  });
}

test('next while paused keeps it paused', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);
  await page.getByTestId('music-next').click();
  const s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.currentTime).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('the track restarts when it ends', async ({ page }) => {
  await openApp(page);
  await startPlaying(page);
  await expect.poll(async () => (await state(page)).duration).toBeGreaterThan(1);
  expect((await state(page)).loop).toBe(false);
  await seek(page, 'nearEnd');
  // Sampling is slow under software GL, so accept any position far from the end
  // rather than a narrow window right after the restart.
  await expect
    .poll(
      async () => {
        const s = await state(page);
        return s.currentTime < 60 && !s.paused;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
});

test('collapse and expand do not interrupt playback', async ({ page }) => {
  await openApp(page);
  await startPlaying(page);

  await page.getByTestId('music-collapse').click();
  await expect(page.getByTestId('music-expand')).toBeVisible();
  await expect(page.getByTestId('music-toggle')).toBeHidden();
  expect((await state(page)).paused).toBe(false);
  await expect(page.getByTestId('music-expand')).toBeFocused();

  await page.getByTestId('music-expand').click();
  await expect(page.getByTestId('music-toggle')).toBeVisible();
  await expect(page.getByTestId('music-collapse')).toBeFocused();
  expect((await state(page)).paused).toBe(false);
});

test('collapsed state survives a reload', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('music-collapse').click();
  await expect(page.getByTestId('music-expand')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId('music-expand')).toBeVisible();
});

test('shows the translated track title', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('music-title')).toContainText('Galaxy Map soundtrack');
});

test.describe('italian locale', () => {
  test.use({ locale: 'it-IT' });
  test('shows the translated track title', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('music-title')).toContainText('Colonna sonora di Galaxy Map');
  });
});

test('keyboard reaches every control', async ({ page }) => {
  await openApp(page);
  // Tab from the start of the page until music-prev is reached (bounded).
  const focusedId = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = (await focusedId()) === 'music-prev';
  }
  expect(reached).toBe(true);
  for (const id of ['music-toggle', 'music-next', 'music-volume', 'music-collapse']) {
    await page.keyboard.press('Tab');
    await expect(page.getByTestId(id)).toBeFocused();
  }
});

test('axe finds no blocking violations, expanded or collapsed', async ({ page }) => {
  await openApp(page);
  const scan = async () => {
    const r = await new AxeBuilder({ page }).include('[data-testid="music-control"]').analyze();
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  };
  await expect(page.getByTestId('music-title')).toBeVisible();
  expect(await scan()).toEqual([]);
  await page.getByTestId('music-collapse').click();
  await expect(page.getByTestId('music-expand')).toBeVisible();
  expect(await scan()).toEqual([]);
});
