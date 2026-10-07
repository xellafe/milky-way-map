/**
 * Bottom control dock gathers Filters/View/Options
 * into one icon row, one panel open at a time. Esc closes the open panel and
 * returns focus to its icon. Music controls live top-right next to the
 * language selector, outside the dock and outside the view switch; they keep
 * playing across View changes and a first gesture on them must not trigger
 * the autoplay-on-first-gesture fallback.
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

test('dock: single tabbed panel, arrow keys switch tab without closing', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Filters' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Filters' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'View' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('view-toggles')).toBeVisible();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
});

test('dock: Esc closes the panel, prevents default and restores focus', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __escPrevented: boolean | null }).__escPrevented = null;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape')
        (window as unknown as { __escPrevented: boolean | null }).__escPrevented =
          e.defaultPrevented;
    });
  });
  await page.getByRole('tab', { name: 'Filters' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dock-panel')).toHaveCount(0);
  await expect(page.getByTestId('filters-toggle')).toBeFocused();
  expect(
    await page.evaluate(() => (window as unknown as { __escPrevented: boolean }).__escPrevented),
  ).toBe(true);
});

test('dock: visible-count sits inside the dock panel', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  const panel = (await page.getByTestId('dock-panel').boundingBox())!;
  const c = (await page.getByTestId('visible-count').boundingBox())!;
  expect(c.x).toBeGreaterThanOrEqual(panel.x);
  expect(c.y).toBeGreaterThanOrEqual(panel.y);
  expect(c.x + c.width).toBeLessThanOrEqual(panel.x + panel.width);
  expect(c.y + c.height).toBeLessThanOrEqual(panel.y + panel.height);
});

test('dock: visible-count stays in the panel header on every tab (galaxy)', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  for (const tab of ['View', 'Options']) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    const panel = (await page.getByTestId('dock-panel').boundingBox())!;
    const counter = page.getByTestId('visible-count');
    await expect(counter).toBeVisible();
    const c = (await counter.boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(panel.x);
    expect(c.y).toBeGreaterThanOrEqual(panel.y);
    expect(c.x + c.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(c.y + c.height).toBeLessThanOrEqual(panel.y + panel.height);
  }
});

test('dock: no music icon, music controls live outside the dock', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('music-toggle-panel')).toHaveCount(0);
  await expect(page.getByTestId('music-control')).toBeVisible();
});

test('music keeps playing across the switch to System View', async ({ page }) => {
  await openApp(page);

  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);

  await page.getByTestId('music-toggle').click();
  await expect.poll(paused).toBe(false);

  await page.getByTestId('search-input').fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await page.getByTestId('view-system-button').click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await expect(page.getByTestId('music-control')).toBeVisible();
  expect(await paused()).toBe(false);
});

test('first gesture on the music controls does not race the autoplay fallback', async ({
  page,
}) => {
  await openApp(page);
  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);

  // Slider: a gesture inside the music zone that does not itself toggle playback.
  await page.getByTestId('music-volume').click();
  expect(await paused()).toBe(true);
});

test('dock: first gesture on a dock icon still starts the music', async ({ page }) => {
  await openApp(page);
  const audio = page.getByTestId('music-audio');
  const paused = () => audio.evaluate((el: HTMLAudioElement) => el.paused);

  await page.getByTestId('filters-toggle').click();
  await expect.poll(paused).toBe(false);
});

const layoutTargets = ['galaxy', 'system'] as const;
for (const view of layoutTargets) {
  test(`music player sits bottom-right, below the top-right group (${view})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openApp(page);
    await page.getByTestId('search-input').fill(view === 'galaxy' ? 'polaris' : 'trappist');
    await page
      .getByRole('option')
      .filter({ hasText: view === 'galaxy' ? 'Polaris' : 'TRAPPIST-1' })
      .first()
      .click();
    if (view === 'system') {
      await page.getByTestId('view-system-button').click();
      await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
    } else {
      await expect(page.getByTestId('star-panel')).toBeVisible();
    }

    const musicBox = await page.getByTestId('music-control').boundingBox();
    const langBox = await page.getByTestId('language-button').boundingBox();
    expect(musicBox).not.toBeNull();
    expect(langBox).not.toBeNull();
    const music = musicBox!;
    const lang = langBox!;
    expect(music.x + music.width).toBeGreaterThanOrEqual(1280 - 24);
    expect(music.y + music.height).toBeGreaterThanOrEqual(720 - 24);
    expect(music.x + music.width).toBeLessThanOrEqual(1280);
    expect(music.y + music.height).toBeLessThanOrEqual(720);
    expect(music.y).toBeGreaterThan(lang.y + lang.height);
  });
}
