/**
 * Hover label follows the camera while the mouse is still (#45).
 * Uses the ?pdb=1 camera debug bridge (window.__camera).
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const camPos = (page: Page) =>
  page.evaluate(
    () =>
      ((globalThis as Record<string, unknown>).__camera as { position: [number, number, number] })
        .position,
  );

test('hover follows camera movement with a still mouse', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('overlay-close').click();
  await waitForFlyToArrival(page);

  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveText('Polaris', { timeout: 5_000 });

  // Hold D with the mouse untouched: the camera slides sideways.
  const before = await camPos(page);
  await page.keyboard.down('KeyD');
  await expect
    .poll(async () => {
      const now = await camPos(page);
      return Math.hypot(now[0] - before[0], now[1] - before[1], now[2] - before[2]);
    })
    .toBeGreaterThan(0.05);
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');

  // No mouse event since: the label must no longer name Polaris (gone, or another star).
  await expect
    .poll(
      () =>
        page
          .getByTestId('hover-label')
          .textContent({ timeout: 500 })
          .catch(() => null),
      {
        timeout: 5_000,
      },
    )
    .not.toBe('Polaris');
});
