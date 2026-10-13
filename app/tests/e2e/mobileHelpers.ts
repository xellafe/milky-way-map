/** Helpers shared by the phone specs (issue #25). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import * as THREE from 'three';
import { waitForFlyToArrival } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

/** The software-rendered canvas runs at a few fps: wait for whole frames, not wall time. */
export const frames = (page: Page, n = 2) =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

export function expectInside(b: Box, vp: { width: number; height: number }, what: string) {
  expect(b.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width, `${what} right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height, `${what} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

/** Every visible [data-hud] element must lie inside the viewport. */
export async function expectHudInViewport(page: Page) {
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

/** Opens the phone search (an icon on phones), types `query` and picks the result named `name`. */
export async function search(page: Page, query: string, name: string) {
  const opener = page.getByTestId('search-open');
  if (await opener.isVisible()) await opener.click();
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: name }).first().click();
}

/** Searches, then waits for the sheet at base and for the camera flight to land. */
export async function select(page: Page, query: string, name: string) {
  await search(page, query, name);
  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  await waitForFlyToArrival(page);
  await frames(page);
}

/** Drags the sheet handle from its centre to (toX, toY) with real mouse events. */
export async function dragHandle(page: Page, toX: number, toY: number) {
  // The handle moves while the sheet transitions between snaps: drag from its settled position.
  // Scoped to the sheet (the canvas animates forever) and bounded so a stuck animation fails loudly.
  await page
    .getByTestId('mobile-sheet')
    .evaluate((el) =>
      Promise.race([
        Promise.all(el.getAnimations().map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 2000)),
      ]),
    );
  const h = (await page.getByTestId('sheet-handle').boundingBox())!;
  const x = h.x + h.width / 2;
  const y = h.y + h.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move((x + toX) / 2, (y + toY) / 2, { steps: 5 });
  await page.mouse.move(toX, toY, { steps: 5 });
  await page.mouse.up();
}

/** World position of a fixture star by proper name (manifest + stars.bin). */
export function fixtureStarPosition(properName: string): THREE.Vector3 {
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
