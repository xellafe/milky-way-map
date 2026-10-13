/**
 * Issue #25 (spec §3): touch gestures in the galaxy view. Touches are
 * synthesized through CDP so Chromium emits real touch pointer events, one
 * explicit id per finger. Uses the ?pdb=1 camera bridge (window.__camera).
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import * as THREE from 'three';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';
import { fixtureStarPosition, frames } from './mobileHelpers';

interface CameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}
interface Pt {
  x: number;
  y: number;
}

const cam = (page: Page) =>
  page.evaluate(
    () => (globalThis as Record<string, unknown>).__camera as never,
  ) as Promise<CameraPose>;

const quatDelta = (a: CameraPose, b: CameraPose) =>
  a.quaternion.reduce((sum, v, i) => sum + Math.abs(v - b.quaternion[i]!), 0);

const vec = (p: CameraPose) => new THREE.Vector3(...p.position);

/** Multi-finger touch driver; every dispatch carries all active fingers. */
class Fingers {
  private active = new Map<number, Pt>();
  constructor(
    private readonly page: Page,
    private readonly cdp: CDPSession,
  ) {}

  private points() {
    return [...this.active].map(([id, p]) => ({ id, x: p.x, y: p.y }));
  }

  private send(type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints = this.points()) {
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }

  async down(id: number, p: Pt) {
    // Fingers must land on the canvas, not on a HUD element.
    const onCanvas = await this.page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS',
      p,
    );
    expect(onCanvas, `finger ${id} at (${p.x}, ${p.y}) must land on the canvas`).toBe(true);
    this.active.set(id, p);
    await this.send('touchStart');
  }

  async move(id: number, p: Pt) {
    this.active.set(id, p);
    await this.send('touchMove');
  }

  /** Move one finger from its current point to `to` in small steps. */
  async slide(id: number, to: Pt, steps = 10) {
    const from = this.active.get(id)!;
    for (let i = 1; i <= steps; i++) {
      await this.move(id, {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      });
    }
  }

  /** CDP touchEnd lists the points being RELEASED, not the survivors. */
  async up(id: number) {
    const p = this.active.get(id)!;
    this.active.delete(id);
    await this.send('touchEnd', [{ id, x: p.x, y: p.y }]);
  }
}

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
  return new Fingers(page, await page.context().newCDPSession(page));
}

async function flyToPolaris(page: Page) {
  const opener = page.getByTestId('search-open');
  if (await opener.isVisible()) await opener.click();
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
}

const centre = async (page: Page): Promise<Pt> => {
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('one-finger drag rotates the view and does not move the camera (regression guard)', async ({
  page,
}) => {
  const f = await openApp(page);
  const before = await cam(page);

  await f.down(1, { x: 80, y: 500 });
  await f.slide(1, { x: 300, y: 500 });
  await f.up(1);
  await frames(page);

  const after = await cam(page);
  expect(quatDelta(before, after)).toBeGreaterThan(0.2);
  expect(vec(before).distanceTo(vec(after))).toBeLessThan(1e-3);
});

test('spreading two fingers with no selection advances along the view direction', async ({
  page,
}) => {
  const f = await openApp(page);
  const before = await cam(page);

  await f.down(1, { x: 150, y: 500 });
  await f.down(2, { x: 225, y: 500 });
  await f.slide(2, { x: 315, y: 500 });
  await f.slide(1, { x: 60, y: 500 });
  await f.up(2);
  await f.up(1);
  await frames(page);

  const after = await cam(page);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
    new THREE.Quaternion(...before.quaternion),
  );
  expect(vec(after).sub(vec(before)).dot(forward)).toBeGreaterThan(0.1);
});

test('with a star selected, spreading dollies toward it and pinching in moves away', async ({
  page,
}) => {
  // software-GL phone canvas: each CDP touch ~1 s (#25)
  test.slow();
  const f = await openApp(page);
  await flyToPolaris(page);
  const polaris = fixtureStarPosition('Polaris');
  const dist = async () => polaris.distanceTo(vec(await cam(page)));

  // Fingers on the canvas, clear of the HUD panels and the anchored card.
  const y = 130;
  const d0 = await dist();
  await f.down(1, { x: 140, y });
  await f.down(2, { x: 235, y });
  await f.slide(2, { x: 330, y });
  await f.slide(1, { x: 45, y });
  await f.up(2);
  await f.up(1);
  await frames(page);
  const d1 = await dist();
  expect(d1).toBeLessThan(d0 - 0.2);

  await f.down(1, { x: 45, y });
  await f.down(2, { x: 330, y });
  await f.slide(2, { x: 235, y });
  await f.slide(1, { x: 140, y });
  await f.up(2);
  await f.up(1);
  await frames(page);
  const d2 = await dist();
  expect(d2).toBeGreaterThan(d1 + 0.2);
});

test('after a pinch, the finger left down rotates smoothly (no jump)', async ({ page }) => {
  const f = await openApp(page);

  // Baseline: quaternion change of a 2 px one-finger drag.
  const b0 = await cam(page);
  await f.down(1, { x: 100, y: 500 });
  await f.move(1, { x: 102, y: 500 });
  await f.up(1);
  await frames(page);
  const baseline = quatDelta(b0, await cam(page));
  expect(baseline).toBeGreaterThan(0);

  // Pinch, lift one finger, nudge the other by 2 px.
  await f.down(1, { x: 150, y: 500 });
  await f.down(2, { x: 225, y: 500 });
  await f.slide(2, { x: 315, y: 500 });
  await f.slide(1, { x: 60, y: 500 });
  await frames(page);
  await f.up(2);
  const b1 = await cam(page);
  await f.move(1, { x: 62, y: 500 });
  await frames(page);
  const nudge = quatDelta(b1, await cam(page));
  await f.up(1);

  // Same order as a 2 px drag: neither frozen nor a jump from a stale position.
  expect(nudge).toBeGreaterThan(baseline / 4);
  expect(nudge).toBeLessThan(baseline * 4);
});

test('a single-finger tap on a star still selects it (guards the pinch-end star point)', async ({
  page,
}) => {
  const f = await openApp(page);
  await flyToPolaris(page);
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('selection-card')).toHaveCount(0);

  await f.down(1, await centre(page));
  await f.up(1);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

test('a pinch that ends over a star does not select it', async ({ page }) => {
  const f = await openApp(page);
  // Isolate the click logic from the browser's own touch handling (which would
  // cancel the pointers by itself and hide a missing guard).
  await page.addStyleTag({ content: 'canvas { touch-action: none; }' });
  await flyToPolaris(page);
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('selection-card')).toHaveCount(0);

  // Finger 2 lands on the star (screen centre) and stays; finger 1 pinches in
  // until it nearly touches it. Lifting finger 2 leaves it within the tap
  // radius of its own touch-down: a "click" on Polaris if a pinch were
  // allowed to produce one.
  const c = await centre(page);
  await f.down(1, { x: c.x + 100, y: c.y });
  await f.down(2, c);
  await f.slide(1, { x: c.x + 2, y: c.y });
  await f.up(2);
  await f.up(1);

  await frames(page, 4);
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
});
