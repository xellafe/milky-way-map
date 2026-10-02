/**
 * Canvas cursor (#11): `grab` at rest, `grabbing` while the left button is
 * held, in both Galaxy and System View.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function enterTrappist(page: Page) {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  const button = page.getByTestId('view-system-button');
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
}

/** A viewport point where the canvas itself (no HUD) receives the pointer. */
async function bareCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    for (const fy of [0.15, 0.3, 0.7, 0.85]) {
      for (const fx of [0.1, 0.25, 0.75, 0.9]) {
        const x = r.x + r.width * fx;
        const y = r.y + r.height * fy;
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
    }
    return null;
  });
  expect(pt).not.toBeNull();
  return pt!;
}

const cursor = (page: Page) => page.locator('canvas').evaluate((el) => getComputedStyle(el).cursor);

async function checkRestAndDrag(page: Page) {
  const { x, y } = await bareCanvasPoint(page);
  await page.mouse.move(x, y);
  await expect.poll(() => cursor(page)).toBe('grab');
  await page.mouse.down();
  await expect.poll(() => cursor(page)).toBe('grabbing');
  await page.mouse.up();
  await expect.poll(() => cursor(page)).toBe('grab');
}

test('galaxy view: grab at rest, grabbing while dragging', async ({ page }) => {
  await openApp(page);
  await checkRestAndDrag(page);
});

test('system view: grab at rest, grabbing while dragging', async ({ page }) => {
  await openApp(page);
  await enterTrappist(page);
  await checkRestAndDrag(page);
});

async function hudPoint(page: Page): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    for (let y = 20; y < innerHeight; y += 40) {
      for (let x = 20; x < innerWidth; x += 40) {
        const hit = document.elementFromPoint(x, y);
        if (hit && hit !== canvas && !hit.contains(canvas)) return { x, y };
      }
    }
    return null;
  });
  expect(pt).not.toBeNull();
  return pt!;
}

for (const view of ['galaxy', 'system'] as const) {
  test(`${view} view: release outside the canvas does not stick on grabbing`, async ({ page }) => {
    await openApp(page);
    if (view === 'system') await enterTrappist(page);
    const { x, y } = await bareCanvasPoint(page);
    const hud = await hudPoint(page);
    await page.mouse.move(x, y);
    await expect.poll(() => cursor(page)).toBe('grab');
    await page.mouse.down();
    await expect.poll(() => cursor(page)).toBe('grabbing');
    await page.mouse.move(hud.x, hud.y);
    await page.mouse.up();
    await page.mouse.move(x, y);
    await expect.poll(() => cursor(page)).toBe('grab');
  });
}
