/**
 * Issue #16: the host star in System View has an animated, textured surface
 * and a corona. Pixels are read from the System View canvas (?pdb=1 keeps the
 * drawing buffer readable); the animation clock comes from the __hostStar
 * bridge.
 *
 * Disc radius: derived analytically instead of measured on the image, because
 * the corona makes the disc edge fuzzy. The initial camera sits at
 * maxA * (1.7, 1.1, 1.7) looking at the origin with a 50 degree vertical fov
 * (SystemScene), the star radius is max(st_rad * R_sun, 0.045 * maxA), so the
 * silhouette radius in pixels is H/2 * tan(asin(r / d)) / tan(fov / 2).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));
const SUN_RADIUS_AU = 0.00465;
const FOV_DEG = 50;
const CAMERA_OFFSET = [1.7, 1.1, 1.7] as const;

interface HostStarBridge {
  time: number;
  look: { animate: boolean; spots: number; pulseAmplitude: number };
}

const hostStar = (page: Page) =>
  page.evaluate(() => (globalThis as Record<string, unknown>).__hostStar as never) as Promise<
    HostStarBridge | undefined
  >;

/** Console errors (three reports GLSL compile failures as errors). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function enterTrappist(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  const button = page.getByTestId('view-system-button');
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
}

function discRadiusPx(canvasHeight: number, distFactor = Math.hypot(...CAMERA_OFFSET)): number {
  const data = JSON.parse(readFileSync(path.join(FIXTURES, 'exoplanets.json'), 'utf-8')) as {
    hosts: Record<string, { st_rad: number; planets: { pl_orbsmax: number }[] }>;
  };
  const host = data.hosts['TRAPPIST-1']!;
  const maxA = Math.max(...host.planets.map((p) => p.pl_orbsmax));
  const r = Math.max(host.st_rad * SUN_RADIUS_AU, maxA * 0.045);
  const d = maxA * distFactor;
  const tanHalfFov = Math.tan((FOV_DEG / 2) * (Math.PI / 180));
  return ((canvasHeight / 2) * Math.tan(Math.asin(r / d))) / tanHalfFov;
}

/** Luminance (0-255) at canvas centre + (dx, dy) * R for each offset, in R units. */
async function sampleLuma(
  page: Page,
  offsets: [number, number][],
  distFactor?: number,
): Promise<number[]> {
  const height = await page.evaluate(
    () => (document.querySelector('canvas') as HTMLCanvasElement).height,
  );
  const radius = discRadiusPx(height, distFactor);
  return page.evaluate(
    ({ offsets, radius }) => {
      const src = document.querySelector('canvas') as HTMLCanvasElement;
      const copy = document.createElement('canvas');
      copy.width = src.width;
      copy.height = src.height;
      const ctx = copy.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      const cx = Math.round(src.width / 2);
      const cy = Math.round(src.height / 2);
      return offsets.map(([dx, dy]) => {
        const [r, g, b] = ctx.getImageData(
          Math.round(cx + dx * radius),
          Math.round(cy + dy * radius),
          1,
          1,
        ).data;
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      });
    },
    { offsets, radius },
  );
}

/** 5x5 grid inside the disc (corner at 0.7 R, safely within the silhouette). */
const GRID: [number, number][] = Array.from({ length: 25 }, (_, i) => [
  ((i % 5) - 2) * 0.175,
  (Math.floor(i / 5) - 2) * 0.175,
]);
const discGrid = (page: Page, distFactor?: number) => sampleLuma(page, GRID, distFactor);

// OrbitControls minDistance in units of maxA (SystemScene): zooming past it
// clamps there, so the camera distance after a long wheel is known exactly.
const MIN_DISTANCE_FACTOR = 0.15;

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const std = (v: number[]) => Math.sqrt(mean(v.map((x) => (x - mean(v)) ** 2)));
const meanAbsDiff = (a: number[], b: number[]) => mean(a.map((x, i) => Math.abs(x - b[i]!)));

// Frame-to-frame change threshold: the surface moves visibly in 1 s; mean
// absolute luminance change over 25 pixels must exceed 0.5/255 (static = 0).
const MOVED = 0.5;

async function expectAnimating(page: Page) {
  await expect.poll(async () => (await hostStar(page)) !== undefined).toBe(true);
  const t0 = (await hostStar(page))!.time;
  const a = await discGrid(page);
  await page.waitForTimeout(1_000);
  const b = await discGrid(page);
  expect((await hostStar(page))!.time).toBeGreaterThan(t0 + 0.5);
  expect(meanAbsDiff(a, b)).toBeGreaterThan(MOVED);
}

test('the star surface is textured', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTrappist(page);
  // At the default camera the disc is ~13 px wide-radius and the grid spans a
  // few pixels, so texture is only meaningful zoomed in: wheel in to the
  // OrbitControls minDistance clamp (disc radius >> 60 px).
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 60; i++) await page.mouse.wheel(0, -200);
  await page.waitForTimeout(1_500); // damping settles
  const height = await page.evaluate(
    () => (document.querySelector('canvas') as HTMLCanvasElement).height,
  );
  expect(discRadiusPx(height, MIN_DISTANCE_FACTOR)).toBeGreaterThan(60);
  const grid = await discGrid(page, MIN_DISTANCE_FACTOR);
  // Sampling sanity: the grid is on the lit disc (not on black space).
  expect(mean(grid)).toBeGreaterThan(30);
  expect(std(grid)).toBeGreaterThan(4);
  expect(errors).toEqual([]);
});

test('the star surface animates in real time', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTrappist(page);
  await expectAnimating(page);
  expect(errors).toEqual([]);
});

test('the star keeps animating while System View time is paused', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTrappist(page);
  await page.getByTestId('time-pause').click();
  await expect(page.getByTestId('time-pause')).toContainText('▶');
  await expectAnimating(page);
  expect(errors).toEqual([]);
});

test('reduced motion freezes the star', async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterTrappist(page);
  await expect.poll(async () => (await hostStar(page)) !== undefined).toBe(true);
  expect((await hostStar(page))!.look.animate).toBe(false);
  const a = await discGrid(page);
  await page.waitForTimeout(1_000);
  const b = await discGrid(page);
  expect(mean(a)).toBeGreaterThan(30); // lit disc, so "identical" is meaningful
  expect(meanAbsDiff(a, b)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('the corona brightens the space around the disc', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTrappist(page);
  await page.waitForTimeout(500);
  // Ring at 1.25 R (outside the silhouette) vs the canvas corner, far from
  // the star and from every planet.
  const ring: [number, number][] = Array.from({ length: 8 }, (_, i) => [
    1.25 * Math.cos((i * Math.PI) / 4),
    1.25 * Math.sin((i * Math.PI) / 4),
  ]);
  const ringLuma = mean(await sampleLuma(page, ring));
  const [corner] = await page.evaluate(() => {
    const src = document.querySelector('canvas') as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const [r, g, b] = ctx.getImageData(4, 4, 1, 1).data;
    return [0.2126 * r! + 0.7152 * g! + 0.0722 * b!];
  });
  expect(ringLuma).toBeGreaterThan(corner! + 2);
  expect(errors).toEqual([]);
});

test('realism applies live in System View', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTrappist(page);
  await expect.poll(async () => (await hostStar(page)) !== undefined).toBe(true);
  expect((await hostStar(page))!.look.spots).toBeGreaterThan(0);
  await page.getByTestId('options-toggle').click();
  await page.getByTestId('option-realism').check();
  await expect.poll(async () => (await hostStar(page))!.look.spots).toBe(0);
  await expect.poll(async () => (await hostStar(page))!.look.pulseAmplitude).toBe(0);
  expect(errors).toEqual([]);
});

test('re-entering System View works', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTrappist(page);
  await expect.poll(async () => (await hostStar(page))?.time ?? 0).toBeGreaterThan(0.5);
  await page.getByTestId('system-back').click();
  await expect(page.getByTestId('system-title')).toHaveCount(0);
  await page.getByTestId('view-system-button').click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await expect.poll(async () => (await hostStar(page)) !== undefined).toBe(true);
  const t0 = (await hostStar(page))!.time;
  await page.waitForTimeout(1_000);
  expect((await hostStar(page))!.time).toBeGreaterThan(t0 + 0.5);
  expect(errors).toEqual([]);
});
