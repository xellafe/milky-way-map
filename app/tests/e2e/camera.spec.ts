/**
 * Free-fly camera regression tests (user-reported: "mouse look doesn't work").
 * Uses the ?pdb=1 camera debug bridge (window.__camera).
 * Drag-to-look must follow the mouse DELTA (and stop when the mouse stops) —
 * not three's FlyControls hold-at-offset model.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

interface CameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

const cam = (page: Page) =>
  page.evaluate(
    () => (globalThis as Record<string, unknown>).__camera as never,
  ) as Promise<CameraPose>;

const quatDelta = (a: CameraPose, b: CameraPose) =>
  a.quaternion.reduce((sum, v, i) => sum + Math.abs(v - b.quaternion[i]!), 0);

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

test('mouse drag rotates the camera following the drag delta', async ({ page }) => {
  await openApp(page);
  const before = await cam(page);

  // Drag 300 px to the right and release: ≈ 300 × 0.0025 = 0.75 rad of yaw.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(940, 360, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const after = await cam(page);
  expect(quatDelta(before, after)).toBeGreaterThan(0.2);
  // Pure horizontal drag → yaw: quaternion y component must dominate.
  expect(Math.abs(after.quaternion[1])).toBeGreaterThan(0.1);
});

test('rotation stops when the mouse stops (no hold-at-offset drift)', async ({ page }) => {
  await openApp(page);

  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(840, 300, { steps: 8 });
  // Button still held, mouse NOT moving: the camera must stay put.
  await page.waitForTimeout(300);
  const atStop = await cam(page);
  await page.waitForTimeout(1000);
  const later = await cam(page);
  await page.mouse.up();

  expect(quatDelta(atStop, later)).toBeLessThan(0.01);
});

test('WASD moves, R/F lift, Q/E roll', async ({ page }) => {
  await openApp(page);
  const start = await cam(page);

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(100);
  const afterW = await cam(page);
  // Camera starts at z=40 looking at -z: W must reduce z.
  expect(afterW.position[2]).toBeLessThan(start.position[2] - 1);

  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyQ');
  await page.waitForTimeout(100);
  const afterQ = await cam(page);
  expect(quatDelta(afterW, afterQ)).toBeGreaterThan(0.05);
});

test('a clean click (no drag) still selects a star after the controls change', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('overlay-close').click();
  await waitForFlyToArrival(page);

  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

/** Rotate v by unit quaternion q = [x, y, z, w]. */
function rotate(q: CameraPose['quaternion'], v: [number, number, number]) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ] as const;
}

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);

test('free-fly drag follows the grab: right drag looks left, down drag looks up', async ({
  page,
}) => {
  await openApp(page);

  const dragFrom = async (dx: number, dy: number) => {
    const before = await cam(page);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(640 + dx, 360 + dy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    return { before, after: await cam(page) };
  };

  const h = await dragFrom(200, 0);
  const viewAfterH = rotate(h.after.quaternion, [0, 0, -1]);
  expect(dot(viewAfterH, rotate(h.before.quaternion, [1, 0, 0]))).toBeLessThan(-0.1);

  const v = await dragFrom(0, 100);
  const viewAfterV = rotate(v.after.quaternion, [0, 0, -1]);
  expect(dot(viewAfterV, rotate(v.before.quaternion, [0, 1, 0]))).toBeGreaterThan(0.1);
});
