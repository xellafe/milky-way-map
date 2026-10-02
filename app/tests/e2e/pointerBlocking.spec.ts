/**
 * No star interaction may pass through HUD UI: panels block the pointer and
 * leaving the canvas for a panel clears the hover state.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

async function openAndSelectPolaris(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
  await waitForFlyToArrival(page);
}

test('every visible HUD panel owns the pointer at its center', async ({ page }) => {
  await openAndSelectPolaris(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();

  const result = await page.evaluate(() =>
    [
      'search-input',
      'dock',
      'star-panel',
      'selection-card',
      'music-control',
      'language-button',
    ].map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return { id, ok: false, why: 'missing' };
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { id, ok: !!hit && el.contains(hit), why: hit?.tagName ?? 'null' };
    }),
  );
  expect(result.filter((r) => !r.ok)).toEqual([]);
});

test('clicking the selection card keeps the selection', async ({ page }) => {
  await openAndSelectPolaris(page);
  const card = (await page.getByTestId('selection-card').boundingBox())!;
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
  await expect(page.getByTestId('selection-card')).toBeVisible();
});

test('moving from a hovered star onto a panel clears hover label and cursor', async ({ page }) => {
  await openAndSelectPolaris(page);
  await page.getByTestId('panel-close').click();

  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveText('Polaris', { timeout: 5_000 });
  expect(await canvas.evaluate((el) => el.style.cursor)).toBe('pointer');

  const dock = (await page.getByTestId('dock').boundingBox())!;
  await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveCount(0, { timeout: 2_000 });
  expect(await canvas.evaluate((el) => el.style.cursor)).not.toBe('pointer');
});
