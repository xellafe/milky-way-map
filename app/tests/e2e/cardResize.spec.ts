/**
 * #23 B1: switching the card mode never makes the card taller than its end states
 * (the Advanced column used to reflow while the card widened).
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

// Samples the card height every frame for `ms` after clicking `clickId`.
async function maxHeightWhileClicking(page: Page, cardId: string, clickId: string, ms = 700) {
  return page.evaluate(
    async ({ cardId, clickId, ms }) => {
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      const card = q(cardId);
      let max = card.getBoundingClientRect().height;
      const end = performance.now() + ms;
      q(clickId).click();
      while (performance.now() < end) {
        await new Promise((r) => requestAnimationFrame(r));
        max = Math.max(max, card.getBoundingClientRect().height);
      }
      return max;
    },
    { cardId, clickId, ms },
  );
}

const height = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!.height;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
});

test('Polaris card: height stays within the end states in both directions', async ({ page }) => {
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await page.waitForTimeout(1500);

  const base = await height(page, 'selection-card');
  const maxUp = await maxHeightWhileClicking(page, 'selection-card', 'card-mode-advanced');
  await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'advanced');
  await page.waitForTimeout(500);
  const adv = await height(page, 'selection-card');
  expect(maxUp).toBeLessThanOrEqual(adv + 1);

  const maxDown = await maxHeightWhileClicking(page, 'selection-card', 'card-mode-base');
  expect(maxDown).toBeLessThanOrEqual(Math.max(adv, base) + 1);
});

test('planet card (TRAPPIST-1 b): Base to Advanced does not overshoot', async ({ page }) => {
  await page.getByTestId('search-input').fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.waitForTimeout(500);
  await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();
  await expect(page.getByTestId('planet-panel')).toBeVisible();
  await page.waitForTimeout(1500);

  const maxUp = await maxHeightWhileClicking(page, 'planet-panel', 'card-mode-advanced');
  await expect(page.getByTestId('planet-panel')).toHaveAttribute('data-mode', 'advanced');
  await page.waitForTimeout(500);
  const adv = await height(page, 'planet-panel');
  expect(maxUp).toBeLessThanOrEqual(adv + 1);
});
