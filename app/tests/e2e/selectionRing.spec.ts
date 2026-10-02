/**
 * Issue #3: bigger selection rings (inner Ø60, outer Ø~95 dashed) and the
 * callout leader joining the star to the card. Hooks the implementation must
 * provide:
 *  - [data-hud=selection-ring]: the ring wrapper (Ø ≈ 95, centered on the star)
 *  - [data-hud=callout]: the SVG <path> of the leader (arc + 45° segment +
 *    horizontal segment); its geometry bbox ends at the card's near edge and
 *    its top sits ~12 px below the card top.
 * Geometry is a human design choice (px CSS), not data.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const RING_D = 95;
const OUTER_R = 47.25;
const INNER_R = 30;
const INNER_DASH = [20.94, 2.62, 2.62, 5.24];
const OUTER_DASH = [4.95, 3.3];

async function openAndSelect(page: Page) {
  // Reduced motion: no lock-in scale animation, so boxes are final.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await page.waitForTimeout(300);
}

/** Free-fly drag follows the grab: dragging right moves the star right (~1.7 px per px). */
async function pushStarRight(page: Page) {
  await page.keyboard.down('KeyS'); // releases the orbit lock, star stays centered
  await page.waitForTimeout(100);
  await page.keyboard.up('KeyS');
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(840, 360, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const rect = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    };
    const circles = [...document.querySelectorAll('[data-hud=selection-ring] circle')].map((c) => ({
      r: Number(c.getAttribute('r')),
      dash: (c.getAttribute('stroke-dasharray') ?? '')
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number),
    }));
    return {
      side: document.querySelector<HTMLElement>('[data-hud=selection-overlay]')?.dataset.side,
      ring: rect('[data-hud=selection-ring]'),
      card: rect('[data-hud=selection-card]'),
      callout: rect('[data-hud=callout]'),
      circles,
      filters: document.querySelectorAll('[data-hud=selection-ring] [filter]').length,
    };
  });

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

function checkCommon(m: Awaited<ReturnType<typeof measure>>) {
  const { ring, card, callout } = m;
  expect(ring, 'ring wrapper').not.toBeNull();
  expect(card, 'card').not.toBeNull();
  expect(callout, 'callout path').not.toBeNull();
  expect(near(ring!.w, RING_D, 4) && near(ring!.h, RING_D, 4), `ring ${ring!.w}x${ring!.h}`).toBe(
    true,
  );

  // Card clear of the outer circle: distance from the star to the card box.
  const cx = ring!.x + ring!.w / 2;
  const cy = ring!.y + ring!.h / 2;
  const dx = Math.max(card!.x - cx, 0, cx - (card!.x + card!.w));
  const dy = Math.max(card!.y - cy, 0, cy - (card!.y + card!.h));
  expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(OUTER_R - 1);

  // The card may be shifted vertically; the leader must still enter its edge.
  const msg = `callout top ${callout!.y} vs card ${card!.y}..${card!.y + card!.h}`;
  expect(callout!.y, msg).toBeGreaterThanOrEqual(card!.y + 8);
  expect(callout!.y, msg).toBeLessThanOrEqual(card!.y + card!.h - 8);
}

test('rings: inner r30 / outer r47.25 dashed, no filter on animated elements', async ({ page }) => {
  await openAndSelect(page);
  const m = await measure(page);
  const inner = m.circles.filter((c) => c.r === INNER_R);
  const outer = m.circles.filter((c) => c.r === OUTER_R);
  expect(inner.length).toBeGreaterThan(0);
  expect(outer.length).toBeGreaterThan(0);
  for (const c of inner) expect(c.dash).toEqual(INNER_DASH);
  for (const c of outer) expect(c.dash).toEqual(OUTER_DASH);
  expect(m.filters).toBe(0);
});

test('right side: ring ~95 px, card clear of the circle, callout meets the card', async ({
  page,
}) => {
  await openAndSelect(page);
  const m = await measure(page);
  expect(m.side).toBe('right');
  checkCommon(m);
  expect(near(m.callout!.x + m.callout!.w, m.card!.x, 3), 'callout end vs card left').toBe(true);
});

test('left side: mirrored callout meets the card right edge', async ({ page }) => {
  await openAndSelect(page);
  await pushStarRight(page);
  const m = await measure(page);
  expect(m.side).toBe('left');
  checkCommon(m);
  expect(near(m.callout!.x, m.card!.x + m.card!.w, 3), 'callout end vs card right').toBe(true);
});

// Chrome snaps border widths to whole px, so the card border can only match a whole-px callout stroke.
test('card border has the same stroke as the callout; other panels keep theirs', async ({
  page,
}) => {
  await openAndSelect(page);
  const m = await page.evaluate(() => {
    const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    const card = cs('[data-hud=selection-card]');
    const callout = cs('[data-hud=callout]');
    const panel = cs('[data-testid=star-panel]');
    return {
      cardWidth: parseFloat(card.borderTopWidth),
      cardColor: card.borderTopColor,
      calloutWidth: parseFloat(callout.strokeWidth),
      calloutColor: callout.stroke,
      calloutOpacity: parseFloat(callout.opacity),
      panelWidth: parseFloat(panel.borderTopWidth),
      panelColor: panel.borderTopColor,
    };
  });

  // Chrome may serialize as rgb()/rgba() or color(srgb r g b / a).
  const parse = (c: string) => {
    const n = (c.match(/-?[\d.]+/g) ?? []).map(Number);
    const scale = c.startsWith('color(') ? 255 : 1; // srgb channels are 0..1 floats
    return { rgb: n.slice(0, 3).map((v) => v * scale), a: n.length > 3 ? n[3]! : 1 };
  };
  const card = parse(m.cardColor);
  const stroke = parse(m.calloutColor);

  expect(m.cardWidth).toBeCloseTo(m.calloutWidth, 1);
  expect(Math.abs(card.a - m.calloutOpacity)).toBeLessThanOrEqual(0.02);
  card.rgb.forEach((v, i) => expect(Math.abs(v - stroke.rgb[i]!)).toBeLessThanOrEqual(2));
  expect(m.panelWidth).toBe(1);
  // Generic .hud-panel border alpha (35%), untouched by the card override.
  expect(Math.abs(parse(m.panelColor).a - 0.35)).toBeLessThanOrEqual(0.02);
});
