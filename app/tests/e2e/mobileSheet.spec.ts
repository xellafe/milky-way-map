/**
 * Issue #25 (spec §4.1, §4.2, §4.4): on phones the star card lives in a single
 * bottom (portrait) / right (landscape) sheet. Uses the ?pdb=1 camera bridge.
 *
 * Star-vs-sheet check: the selected star is projected from window.__camera
 * (the selection ring is desktop-only and not rendered on phones).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import * as THREE from 'three';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

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

/** The software-rendered canvas runs at a few fps: wait for whole frames, not wall time. */
const frames = (page: Page, n = 2) =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

async function open(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await frames(page, 3);
}

async function select(page: Page, query: string, name: string) {
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  await waitForFlyToArrival(page);
  await frames(page);
}

/** Every visible [data-hud] element must lie inside the viewport. */
async function expectHudInViewport(page: Page) {
  const vp = page.viewportSize()!;
  const offenders = await page.evaluate(
    ({ w, h }) =>
      [...document.querySelectorAll('[data-hud]')]
        .map((el) => ({ hud: el.getAttribute('data-hud'), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0)
        .filter(({ r }) => r.left < -0.5 || r.top < -0.5 || r.right > w + 0.5 || r.bottom > h + 0.5)
        .map(({ hud, r }) => `${hud}: ${r.left},${r.top},${r.right},${r.bottom}`),
    { w: vp.width, h: vp.height },
  );
  expect(offenders).toEqual([]);
}

const sheetBox = async (page: Page) => (await page.getByTestId('mobile-sheet').boundingBox())!;

for (const [name, size] of [
  ['portrait', { width: 375, height: 812 }],
  ['landscape', { width: 812, height: 375 }],
] as const) {
  test.describe(name, () => {
    test.use({ viewport: size });

    test('selecting Polaris opens the sheet at base with the card title', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      await expect(page.getByTestId('mobile-sheet').getByTestId('panel-title')).toHaveText(
        'Polaris',
      );
      const box = await sheetBox(page);
      if (name === 'portrait') {
        expect(box.width).toBeGreaterThanOrEqual(size.width - 1);
        expect(box.y + box.height).toBeGreaterThanOrEqual(size.height - 1);
        expect(box.y).toBeGreaterThan(size.height * 0.5);
      } else {
        expect(box.x + box.width).toBeGreaterThanOrEqual(size.width - 1);
        expect(box.width).toBeLessThanOrEqual(size.width * 0.5 + 1);
        expect(box.height).toBeGreaterThanOrEqual(size.height - 1);
      }
    });

    test('a star with planets also shows the system button', async ({ page }) => {
      await open(page);
      await select(page, 'proxima cen', 'Proxima');
      await expect(
        page.getByTestId('mobile-sheet').getByTestId('view-system-button'),
      ).toBeVisible();
    });

    test('the handle toggles base and expanded and reveals the Advanced column', async ({
      page,
    }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      await expect(page.getByTestId('card-advanced')).toHaveCount(0);

      await page.getByTestId('sheet-handle').click();
      await expect(sheet).toHaveAttribute('data-snap', 'expanded');
      await expect(page.getByTestId('card-advanced')).toBeVisible();

      await page.getByTestId('sheet-handle').click();
      await expect(sheet).toHaveAttribute('data-snap', 'base');
      await expect(page.getByTestId('card-advanced')).toHaveCount(0);
    });

    test('closing the card removes the sheet', async ({ page }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      await page.getByTestId('overlay-close').click();
      await expect(page.getByTestId('mobile-sheet')).toHaveCount(0);
    });

    test('no HUD element leaves the viewport with the sheet closed, base and expanded', async ({
      page,
    }) => {
      await open(page);
      await expect(page.getByTestId('mobile-sheet')).toHaveCount(0);
      await expectHudInViewport(page);
      await select(page, 'polaris', 'Polaris');
      await expectHudInViewport(page);
      await page.getByTestId('sheet-handle').click();
      await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'expanded');
      await expectHudInViewport(page);
    });

    test('the selected star is not hidden behind the sheet once the fly-to ends', async ({
      page,
    }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const pose = (await page.evaluate(
        () => (globalThis as Record<string, unknown>).__camera,
      )) as {
        position: [number, number, number];
        quaternion: [number, number, number, number];
        viewOffset?: { x: number; y: number };
      };
      const offset = pose.viewOffset ?? { x: 0, y: 0 };
      // Same fov/near/far as GalaxyScene's camera. A view offset of +x moves the scene left.
      const cam = new THREE.PerspectiveCamera(60, size.width / size.height, 0.1, 2_000_000);
      cam.position.set(...pose.position);
      cam.quaternion.set(...pose.quaternion);
      cam.updateMatrixWorld(true);
      const ndc = fixtureStarPosition('Polaris').project(cam);
      const star = {
        x: ((ndc.x + 1) / 2) * size.width - offset.x,
        y: ((1 - ndc.y) / 2) * size.height - offset.y,
      };
      const box = await sheetBox(page);
      const clearance = 16; // px, aesthetic choice (not data)
      const outside =
        star.x <= box.x - clearance ||
        star.x >= box.x + box.width + clearance ||
        star.y <= box.y - clearance ||
        star.y >= box.y + box.height + clearance;
      expect(
        outside,
        `star at ${star.x},${star.y} (offset ${JSON.stringify(offset)}) vs sheet ${JSON.stringify(box)}`,
      ).toBe(true);
    });
  });
}

test('rotating the phone keeps the snap and moves the sheet to the right', async ({ page }) => {
  await open(page);
  await select(page, 'polaris', 'Polaris');
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'landscape');
  await frames(page);

  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  expect((await sheetBox(page)).x).toBeGreaterThanOrEqual(406);
  await expectHudInViewport(page);
});
