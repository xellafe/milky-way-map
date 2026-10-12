/**
 * Issue #25 (spec §4.2-§4.4): System View in the phone sheet. Uses the ?pdb=1
 * __system bridge. Besides the existing fields the tests need two bridge
 * fields that the scene must publish in test mode:
 *   cameraPosition: [x, y, z]            camera world position
 *   followedScreen: [x, y] | null        viewport px of the followed planet
 * The scene runs at a few fps in software rendering: wait on rAF frames.
 */
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { readFixtureExoplanets, serveFixtureData } from './fixtures';

const frames = (page: Page, n = 2) =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

function expectInside(b: Box, vp: { width: number; height: number }, what: string) {
  expect(b.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width, `${what} right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height, `${what} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

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

interface SystemBridge {
  cameraTarget: [number, number, number];
  cameraPosition?: [number, number, number];
  followedScreen?: [number, number] | null;
}
const bridge = (page: Page) =>
  page.evaluate(
    () => (globalThis as Record<string, unknown>).__system as never,
  ) as Promise<SystemBridge>;

async function enterSystem(page: Page, query: string, name: string) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await frames(page, 3);
  const opener = page.getByTestId('search-open');
  if (await opener.isVisible()) await opener.click();
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  // Hosts with a catalogue star (not TRAPPIST-1) enter through the card button.
  if (name !== 'TRAPPIST-1') {
    const button = page.getByTestId('view-system-button');
    await expect(button).toBeEnabled({ timeout: 10_000 });
    await button.click();
  }
  await expect(page.getByTestId('system-title')).toHaveText(name);
  await expect.poll(async () => (await bridge(page)) !== undefined).toBe(true);
  await frames(page, 3);
}

const sheet = (page: Page) => page.getByTestId('mobile-sheet');

/** Longest host name in the golden fixture, to stress the header. */
const longestHost = () =>
  Object.keys(readFixtureExoplanets().hosts).reduce((a, b) => (b.length > a.length ? b : a));

const SIZES = [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
] as const;

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('entering the system opens the base sheet on the Star tab; Planets lists the chips', async ({
      page,
    }) => {
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      await expect(sheet(page)).toHaveAttribute('data-snap', 'base');
      await expect(sheet(page).getByTestId('sheet-tab-star')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(sheet(page).getByTestId('system-star-panel')).toBeVisible();
      await sheet(page).getByTestId('sheet-tab-planets').click();
      await expect(sheet(page).getByTestId('planet-list')).toBeVisible();
      const planets = readFixtureExoplanets().hosts['TRAPPIST-1']!.planets.length;
      await expect(sheet(page).getByTestId('planet-chip')).toHaveCount(planets);
    });

    test('a planet chip opens the planet card in the sheet; the close button returns to Planets', async ({
      page,
    }) => {
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      await sheet(page).getByTestId('sheet-tab-planets').click();
      await sheet(page).getByTestId('planet-chip').first().click();
      await expect(sheet(page).getByTestId('planet-panel')).toBeVisible();
      await sheet(page).getByTestId('planet-close').click();
      await expect(page.getByTestId('planet-panel')).toHaveCount(0);
      await expect(sheet(page).getByTestId('planet-list')).toBeVisible();
      await expect(sheet(page).getByTestId('planet-chip').first()).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    test('a pinch changes the camera distance', async ({ page }) => {
      test.slow();
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      const dist = async () => {
        const b = await bridge(page);
        const p = b.cameraPosition;
        expect(p, 'bridge.cameraPosition').toBeDefined();
        return Math.hypot(...p!.map((v, i) => v - b.cameraTarget[i]!));
      };
      const d0 = await dist();
      const cdp: CDPSession = await page.context().newCDPSession(page);
      // Upper-left canvas area, clear of the sheet in both orientations.
      const y = 150;
      const at = (a: number, b: number) => [
        { id: 1, x: a, y },
        { id: 2, x: b, y },
      ];
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: object[]) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints } as never);
      await touch('touchStart', at(120, 180));
      for (let i = 1; i <= 8; i++) await touch('touchMove', at(120 - i * 8, 180 + i * 12));
      await touch('touchEnd', at(56, 276));
      await frames(page, 4);
      expect(Math.abs((await dist()) - d0)).toBeGreaterThan(0.01);
    });

    test('the followed planet is not behind the sheet (AC7)', async ({ page }) => {
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      await sheet(page).getByTestId('sheet-tab-planets').click();
      await sheet(page).getByTestId('planet-chip').first().click();
      await page.waitForTimeout(1800);
      await frames(page, 3);
      const s = (await bridge(page)).followedScreen;
      expect(s, 'bridge.followedScreen').toBeTruthy();
      const b = await box(sheet(page));
      const clearance = 16; // px, aesthetic choice (not data)
      const outside =
        s![0] <= b.x - clearance ||
        s![0] >= b.x + b.width + clearance ||
        s![1] <= b.y - clearance ||
        s![1] >= b.y + b.height + clearance;
      expect(outside, `planet at ${s} vs sheet ${JSON.stringify(b)}`).toBe(true);
    });

    test('the Time tab shows time-scale inside the sheet and the viewport', async ({ page }) => {
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      await page.getByTestId('time-toggle').click();
      await expect(sheet(page).getByTestId('time-scale')).toBeVisible();
      const tb = await box(page.getByTestId('time-scale'));
      const sb = await box(sheet(page));
      expectInside(tb, size, 'time-scale');
      expect(tb.x).toBeGreaterThanOrEqual(sb.x - 0.5);
      expect(tb.y).toBeGreaterThanOrEqual(sb.y - 0.5);
      expect(tb.x + tb.width).toBeLessThanOrEqual(sb.x + sb.width + 0.5);
      expect(tb.y + tb.height).toBeLessThanOrEqual(sb.y + sb.height + 0.5);
    });

    test('tapping system-back leaves the system (not covered by the top bar)', async ({ page }) => {
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      const layout = await page.locator('[data-layout]').getAttribute('data-layout');
      // Real hit-testing, no force: fails if another element intercepts the tap.
      await page.getByTestId('system-back').tap({ timeout: 10_000 });
      await expect(page.getByTestId('system-title')).toHaveCount(0);
      await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', layout!);
    });

    test('no HUD element leaves the viewport at base and expanded', async ({ page }) => {
      await enterSystem(page, 'trappist', 'TRAPPIST-1');
      await expectHudInViewport(page);
      await page.getByTestId('sheet-handle').click();
      await expect(sheet(page)).toHaveAttribute('data-snap', 'expanded');
      await expectHudInViewport(page);
    });
  });
}

test.describe('360x640 header', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the longest host name is truncated, inside the viewport, clear of help and language', async ({
    page,
  }) => {
    const host = longestHost();
    await enterSystem(page, host.slice(0, 5), host);
    const vp = page.viewportSize()!;
    const title = await box(page.getByTestId('system-title'));
    const help = await box(page.getByTestId('help-button'));
    const lang = await box(page.getByTestId('language-button'));
    expectInside(title, vp, 'system-title');
    expectInside(help, vp, 'help');
    expectInside(lang, vp, 'language');
    expect(overlaps(title, help), 'title/help').toBe(false);
    expect(overlaps(title, lang), 'title/language').toBe(false);
    const overflow = await page
      .getByTestId('system-title')
      .evaluate((el) => getComputedStyle(el).textOverflow);
    expect(overflow).toBe('ellipsis');
    await expectHudInViewport(page);
  });
});
