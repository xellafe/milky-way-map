/**
 * M5 acceptance (SPEC §6.3): fly-to transitions are ANIMATED (interpolated,
 * not a jump), locking a star switches the camera to orbit around it, the
 * lock can be released, and prefers-reduced-motion degrades transitions to
 * instant jumps. Uses the ?pdb=1 camera bridge (position/quaternion/mode);
 * the orbit target position is read from the golden fixture itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import * as THREE from 'three';
import { serveFixtureData } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));
// Keep in sync with src/scene/cameraTween.ts.
const ARRIVE_DISTANCE_LY = 4;

interface CameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  mode: 'free-fly' | 'orbit';
}

const cam = (page: Page) =>
  page.evaluate(
    () => (globalThis as Record<string, unknown>).__camera as never,
  ) as Promise<CameraPose>;

/** World position of a fixture star by proper name (manifest + stars.bin). */
function fixtureStarPosition(properName: string): THREE.Vector3 {
  const names = JSON.parse(
    readFileSync(path.join(FIXTURES, 'names.index.json'), 'utf-8'),
  ) as Record<string, { proper?: string }>;
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { count: number; attributes: { name: string; byteOffset: number }[] };
  const entry = Object.entries(names).find(([, e]) => e.proper === properName);
  if (!entry) throw new Error(`${properName} not in fixture`);
  const index = Number(entry[0]);
  const bin = readFileSync(path.join(FIXTURES, 'stars.bin'));
  const meta = manifest.attributes.find((a) => a.name === 'position')!;
  const pos = new Float32Array(
    bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
    meta.byteOffset,
    manifest.count * 3,
  );
  return new THREE.Vector3(pos[index * 3]!, pos[index * 3 + 1]!, pos[index * 3 + 2]!);
}

const distanceTo = (pose: CameraPose, target: THREE.Vector3) =>
  target.distanceTo(new THREE.Vector3(...pose.position));

/** cos(angle) between the camera forward (-z) and the direction to target. */
const aimDot = (pose: CameraPose, target: THREE.Vector3) => {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
    new THREE.Quaternion(...pose.quaternion),
  );
  const dir = target
    .clone()
    .sub(new THREE.Vector3(...pose.position))
    .normalize();
  return forward.dot(dir);
};

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

async function selectPolaris(page: Page) {
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
}

async function waitForArrival(page: Page, target: THREE.Vector3) {
  await expect
    .poll(async () => distanceTo(await cam(page), target), { timeout: 15_000 })
    .toBeLessThan(ARRIVE_DISTANCE_LY + 0.5);
}

/**
 * Samples __camera in-page every 50 ms until the camera lands within
 * `untilDistance` of `target` (30 s cap). Runs inside the page so it is NOT
 * starved when parallel WebGL test pages slow the Node-side runner down —
 * a Node poll can miss an entire 2.5 s flight under load.
 */
function startCameraSampling(page: Page, target: THREE.Vector3, untilDistance: number) {
  return page.evaluate(
    async ({ t, d }) => {
      const out: [number, number, number][] = [];
      for (let i = 0; i < 600; i++) {
        const c = (globalThis as { __camera?: { position: [number, number, number] } }).__camera;
        if (c) {
          out.push([c.position[0], c.position[1], c.position[2]]);
          const dist = Math.hypot(c.position[0] - t[0], c.position[1] - t[1], c.position[2] - t[2]);
          if (dist < d) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return out;
    },
    { t: [target.x, target.y, target.z], d: untilDistance },
  );
}

test('search select flies to the star with an interpolated transition and locks in orbit', async ({
  page,
}) => {
  const target = fixtureStarPosition('Polaris'); // ~430 ly from the start pose
  await openApp(page);
  const start = await cam(page);
  expect(start.mode).toBe('free-fly');

  await page.getByTestId('search-input').fill('polaris');
  const option = page.getByRole('option').filter({ hasText: 'Polaris' }).first();
  await expect(option).toBeVisible();
  const samplesPromise = startCameraSampling(page, target, ARRIVE_DISTANCE_LY + 0.5);
  await option.click();

  // Mid-flight evidence of interpolation: some sample has left the start pose
  // but is still far from the target (an instant jump would already be there).
  const startVec = new THREE.Vector3(...start.position);
  const samples = await samplesPromise;
  const midFlight = samples.some((p) => {
    const v = new THREE.Vector3(...p);
    return startVec.distanceTo(v) > 1 && target.distanceTo(v) > ARRIVE_DISTANCE_LY + 20;
  });
  expect(midFlight).toBe(true);

  // Arrival: ARRIVE_DISTANCE in front of the target, looking at it, orbit on.
  await waitForArrival(page, target);
  const arrived = await cam(page);
  expect(distanceTo(arrived, target)).toBeGreaterThan(ARRIVE_DISTANCE_LY - 0.5);
  expect(aimDot(arrived, target)).toBeGreaterThan(0.999);
  expect(arrived.mode).toBe('orbit');
});

test('prefers-reduced-motion: the fly-to is an instant jump', async ({ page }) => {
  const target = fixtureStarPosition('Polaris');
  await openApp(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const start = await cam(page);
  await page.getByTestId('search-input').fill('polaris');
  const option = page.getByRole('option').filter({ hasText: 'Polaris' }).first();
  await expect(option).toBeVisible();
  const samplesPromise = startCameraSampling(page, target, ARRIVE_DISTANCE_LY + 0.5);
  await option.click();

  // Instant jump = NO intermediate pose: every sample is either still at the
  // start or already at the target (an animated flight would leave a trail).
  const startVec = new THREE.Vector3(...start.position);
  const samples = await samplesPromise;
  for (const p of samples) {
    const v = new THREE.Vector3(...p);
    const atStart = startVec.distanceTo(v) < 1;
    const atTarget = target.distanceTo(v) < ARRIVE_DISTANCE_LY + 0.5;
    expect(atStart || atTarget).toBe(true);
  }
  await waitForArrival(page, target);
  expect((await cam(page)).mode).toBe('orbit');

  // Perpetual ambient auto-orbit is also disabled: the camera stays put.
  const p1 = await cam(page);
  await page.waitForTimeout(600);
  const p2 = await cam(page);
  expect(
    new THREE.Vector3(...p1.position).distanceTo(new THREE.Vector3(...p2.position)),
  ).toBeLessThan(0.01);
});

test('ambient auto-orbit revolves around the locked star until a manual drag', async ({ page }) => {
  const target = fixtureStarPosition('Polaris');
  await openApp(page);
  await selectPolaris(page);
  await waitForArrival(page, target);

  // Hands off: the camera keeps revolving (constant radius, star centered).
  const p1 = await cam(page);
  await page.waitForTimeout(600);
  const p2 = await cam(page);
  const drift = new THREE.Vector3(...p1.position).distanceTo(new THREE.Vector3(...p2.position));
  expect(drift).toBeGreaterThan(0.05); // ~0.24 ly at 0.1 rad/s on a 4 ly radius
  expect(Math.abs(distanceTo(p2, target) - distanceTo(p1, target))).toBeLessThan(0.05);
  expect(aimDot(p2, target)).toBeGreaterThan(0.999);

  // A manual orbit drag takes over: the ambient revolution stops for good.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(680, 380, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const p3 = await cam(page);
  await page.waitForTimeout(600);
  const p4 = await cam(page);
  expect(
    new THREE.Vector3(...p3.position).distanceTo(new THREE.Vector3(...p4.position)),
  ).toBeLessThan(0.01);
  expect((await cam(page)).mode).toBe('orbit');
});

test('clicking a star flies to the fixed arrival distance', async ({ page }) => {
  const target = fixtureStarPosition('Polaris');
  await openApp(page);
  await selectPolaris(page);
  await waitForArrival(page, target);

  // Zoom away from the star, then click it again (it stays screen-centered):
  // the camera must fly back to the fixed ARRIVE_DISTANCE_LY.
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(async () => distanceTo(await cam(page), target), { timeout: 5_000 })
    .toBeGreaterThan(ARRIVE_DISTANCE_LY + 2);

  await page.mouse.click(640, 360);
  await expect
    .poll(async () => distanceTo(await cam(page), target), { timeout: 8_000 })
    .toBeLessThan(ARRIVE_DISTANCE_LY + 0.5);
  const arrived = await cam(page);
  expect(distanceTo(arrived, target)).toBeGreaterThan(ARRIVE_DISTANCE_LY - 0.5);
  expect(arrived.mode).toBe('orbit');
  await expect(page.getByTestId('star-panel')).toBeVisible();
});

test('orbit lock: drag circles the star keeping it centered, wheel zooms, movement key releases', async ({
  page,
}) => {
  const target = fixtureStarPosition('Polaris');
  await openApp(page);
  await selectPolaris(page);
  await waitForArrival(page, target);
  const before = await cam(page);

  // Drag: the camera POSITION must move (free-look would only rotate),
  // the orbit radius stays constant and the star stays centered.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(840, 420, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await cam(page);
  expect(after.mode).toBe('orbit');
  const moved = new THREE.Vector3(...before.position).distanceTo(
    new THREE.Vector3(...after.position),
  );
  expect(moved).toBeGreaterThan(0.5);
  expect(Math.abs(distanceTo(after, target) - distanceTo(before, target))).toBeLessThan(0.05);
  expect(aimDot(after, target)).toBeGreaterThan(0.999);

  // Wheel zoom: deltaY < 0 dollies toward the locked star.
  const beforeZoom = distanceTo(after, target);
  // The drag ended under the selection card, which blocks the wheel: move to a free canvas point.
  await page.mouse.move(300, 360);
  await page.mouse.wheel(0, -600);
  await expect
    .poll(async () => distanceTo(await cam(page), target), { timeout: 2_000 })
    .toBeLessThan(beforeZoom * 0.7);
  expect(aimDot(await cam(page), target)).toBeGreaterThan(0.999);

  // A translation key releases the lock back to free-fly; the selection
  // (details panel) stays open.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await cam(page)).mode).toBe('free-fly');
  await expect(page.getByTestId('star-panel')).toBeVisible();
});
