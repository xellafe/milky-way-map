/**
 * Issue #42: the time bar keeps its resume speed and log-scale switch when it
 * unmounts (phone sheet tab change, compact expanded player), and the
 * play/pause button's accessible name is only its label.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const bridgeTimeScale = (page: Page) =>
  page.evaluate(
    () =>
      ((globalThis as Record<string, unknown>).__system as { timeScale: number } | undefined)
        ?.timeScale ?? -1,
  );

async function enterTrappist(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  const opener = page.getByTestId('search-open');
  if (await opener.isVisible()) await opener.click();
  await page.getByTestId('search-input').fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await expect.poll(() => bridgeTimeScale(page)).toBeGreaterThanOrEqual(0);
}

/** Non-default speed, log mode on, then pause; returns the speed shown before pausing. */
async function setSpeedLogAndPause(page: Page): Promise<string> {
  await page.getByTestId('time-slider').fill('700');
  await page.getByTestId('time-log-mode').check();
  const shown = (await page.getByTestId('time-scale-value').textContent())!;
  const speed = await bridgeTimeScale(page);
  expect(speed).not.toBe(2);
  await page.getByTestId('time-pause').click();
  await expect.poll(() => bridgeTimeScale(page)).toBe(0);
  return `${shown}|${speed}`;
}

async function expectRestored(page: Page, before: string) {
  const [shown, speed] = before.split('|');
  await page.getByTestId('time-pause').click();
  await expect(page.getByTestId('time-scale-value')).toHaveText(shown!);
  expect(await bridgeTimeScale(page)).toBeCloseTo(Number(speed), 5);
  await expect(page.getByTestId('time-log-mode')).toBeChecked();
}

test.describe('phone sheet', () => {
  // Coarse pointer + touch: the phone layout (sheet) is chosen by layoutMode, not by width alone.
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('resume speed and log switch survive a tab change', async ({ page }) => {
    await enterTrappist(page);
    await page.getByTestId('time-toggle').click();
    const before = await setSpeedLogAndPause(page);

    await page.getByTestId('tab-options').click();
    await expect(page.getByTestId('time-pause')).toHaveCount(0);
    await page.getByTestId('tab-time').click();

    await expectRestored(page, before);
  });
});

test.describe('compact desktop', () => {
  test.use({ viewport: { width: 800, height: 900 } });

  test('resume speed and log switch survive the expanded player', async ({ page }) => {
    await enterTrappist(page);
    await page.getByTestId('music-collapse').click();
    const before = await setSpeedLogAndPause(page);

    await page.getByTestId('music-expand').click();
    await expect(page.getByTestId('time-pause')).toBeHidden();
    await page.getByTestId('music-collapse').click();

    await expectRestored(page, before);
  });
});

test('play/pause button name is only its label; glyph is aria-hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await enterTrappist(page);
  const button = page.getByTestId('time-pause');
  await expect(button).toHaveAccessibleName('Pause');
  await expect(button.locator('[aria-hidden]')).toHaveText('⏸');
  await button.click();
  await expect(button).toHaveAccessibleName('Resume');
  await expect(button.locator('[aria-hidden]')).toHaveText('▶');
});
