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
    .poll(async () => distanceTo(await cam(page), target), { timeout: 6_000 })
    .toBeLessThan(ARRIVE_DISTANCE_LY + 0.5);
}

test('search select flies to the star with an interpolated transition and locks in orbit', async ({
  page,
}) => {
  const target = fixtureStarPosition('Polaris'); // ~430 ly from the start pose
  await openApp(page);
  const start = await cam(page);
  expect(start.mode).toBe('free-fly');

  await selectPolaris(page);

  // Mid-flight evidence of interpolation: the camera has left the start pose
  // but is still far from the target (an instant jump would already be there).
  const startVec = new THREE.Vector3(...start.position);
  await expect
    .poll(async () => startVec.distanceTo(new THREE.Vector3(...(await cam(page)).position)), {
      timeout: 3_000,
    })
    .toBeGreaterThan(1);
  const mid = await cam(page);
  expect(distanceTo(mid, target)).toBeGreaterThan(ARRIVE_DISTANCE_LY + 20);

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

  await selectPolaris(page);

  // The animated flight to Polaris would take the full 2.5 s: being at the
  // target well within 1 s proves the reduced-motion instant path.
  await expect
    .poll(async () => distanceTo(await cam(page), target), { timeout: 1_000 })
    .toBeLessThan(ARRIVE_DISTANCE_LY + 0.5);
  expect((await cam(page)).mode).toBe('orbit');
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
