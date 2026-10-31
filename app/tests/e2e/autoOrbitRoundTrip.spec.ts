/**
 * #46: the ambient auto-orbit state survives a System View round trip. A revolution
 * stopped by a drag stays stopped, a running one keeps running, and selecting a
 * different star re-arms it. Uses the ?pdb=1 __camera bridge.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

type Vec = [number, number, number];

const cam = (page: Page) =>
  page.evaluate(
    () => (globalThis as Record<string, unknown>).__camera as { position: Vec } | undefined,
  );

const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function pos(page: Page): Promise<Vec> {
  return (await cam(page))!.position;
}

async function select(page: Page, query: string, optionText: string) {
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: optionText }).first().click();
}

/** Waits until the camera stops flying (consecutive samples within 0.5 ly). */
async function waitSettled(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await pos(page);
        await page.waitForTimeout(150);
        return dist(a, await pos(page));
      },
      { timeout: 15_000 },
    )
    .toBeLessThan(0.5);
}

async function roundTrip(page: Page) {
  await expect(page.getByTestId('view-system-button')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('view-system-button').click();
  await expect(page.getByTestId('system-title')).toHaveText('Proxima Cen');
  // The galaxy Canvas is unmounted: drop the stale bridge so the poll waits for the remount.
  await page.evaluate(() => {
    delete (globalThis as Record<string, unknown>).__camera;
  });
  await page.getByTestId('system-back').click();
  await expect.poll(async () => (await cam(page)) !== undefined).toBe(true);
}

async function openAndSelectProxima(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
  await select(page, 'proxima cen', 'Proxima Cen');
  await waitSettled(page);
}

async function drift(page: Page, ms: number) {
  const a = await pos(page);
  await page.waitForTimeout(ms);
  return dist(a, await pos(page));
}

test('auto-orbit stopped by a drag stays stopped after the System View round trip', async ({
  page,
}) => {
  await openAndSelectProxima(page);
  expect(await drift(page, 600)).toBeGreaterThan(0.05); // revolving

  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(680, 380, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const before = await pos(page);

  await roundTrip(page);
  expect(dist(await pos(page), before)).toBeLessThan(0.01);
  expect(await drift(page, 600)).toBeLessThan(0.01);

  // A different star still starts a new revolution.
  await select(page, 'polaris', 'Polaris');
  await waitSettled(page);
  expect(await drift(page, 600)).toBeGreaterThan(0.05);
});

test('auto-orbit running when entering the System View keeps running after Back', async ({
  page,
}) => {
  await openAndSelectProxima(page);
  await roundTrip(page);

  expect(await drift(page, 600)).toBeGreaterThan(0.05);
});
