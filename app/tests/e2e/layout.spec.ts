/**
 * #23 AC7: the HUD stays out of its own way. Bounding boxes, not DOM presence:
 * at the two reference desktop sizes, with the tallest realistic content open,
 * no two HUD blocks intersect and floating cards stay in the usable band.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

// Polaris must end up closer than this to the right edge, px: it forces the
// anchored card to flip to the left of the star (aesthetic test choice).
const EDGE_BAND_PX = 150;
// Vertical fov of the galaxy camera (GalaxyScene), degrees.
const GALAXY_FOV_DEG = 60;
// Free-fly look rate (CameraControls LOOK_SENSITIVITY), rad per drag px.
const LOOK_RAD_PER_PX = 0.0025;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const hud = (page: Page, name: string) => page.locator(`[data-hud=${name}]`);

async function box(loc: Locator, what: string): Promise<Box> {
  await expect(loc, what).toBeVisible();
  return (await loc.boundingBox())!;
}

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

function expectDisjoint(named: [string, Box][]) {
  for (let i = 0; i < named.length; i++)
    for (let j = i + 1; j < named.length; j++)
      expect(
        intersects(named[i]![1], named[j]![1]),
        `${named[i]![0]} intersects ${named[j]![0]}: ${JSON.stringify([named[i]![1], named[j]![1]])}`,
      ).toBe(false);
}

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

/**
 * Yaws the free-fly camera so the selected star (centred after the fly-to)
 * lands in the right edge band. Pinhole model, no measuring loop (every frame
 * is slow under software GL): a yaw of theta moves a centred star to
 * x = W/2 + f * tan(theta), f = (H/2) / tan(fov/2); the look rate is
 * LOOK_RAD_PER_PX. The result is asserted once afterwards.
 */
async function pushPolarisToRightEdge(
  page: Page,
  { width, height }: { width: number; height: number },
) {
  await page.keyboard.down('KeyS'); // releases the orbit lock, selection stays
  await page.waitForTimeout(100);
  await page.keyboard.up('KeyS');
  const focalPx = height / 2 / Math.tan((GALAXY_FOV_DEG / 2) * (Math.PI / 180));
  const yaw = Math.atan((width / 2 - EDGE_BAND_PX / 2) / focalPx);
  const drag = Math.round(yaw / LOOK_RAD_PER_PX);
  await page.mouse.move(100, 360);
  await page.mouse.down();
  await page.mouse.move(100 + drag, 360, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const ring = (await hud(page, 'selection-ring').boundingBox())!;
  const x = ring.x + ring.width / 2;
  expect(width - x, 'Polaris within the right edge band').toBeLessThan(EDGE_BAND_PX);
  expect(x, 'Polaris still on screen').toBeLessThan(width);
}

for (const size of SIZES) {
  const label = `${size.width}x${size.height}`;

  test(`${label} galaxy: search, bottom stack and music player stay apart, card in the usable band`, async ({
    page,
  }) => {
    // Every action waits for a software-GL frame of the full star cloud: ~40 s alone and ~60 s
    // under parallel load at 1080p, so the default 60 s budget is tripled (not a retry).
    if (size.height >= 1080) test.slow();
    // Reduced motion: instant fly-to and no ring/card animation, so software-GL frames stay cheap.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(size);
    await openApp(page);
    await page.getByTestId('search-input').fill('polaris');
    await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click({ force: true });
    await expect(page.getByTestId('selection-card')).toBeVisible();
    await page.getByTestId('card-mode-advanced').click({ force: true });
    await expect(page.getByTestId('card-advanced')).toBeVisible();
    await page.getByTestId('filters-toggle').click({ force: true });
    await expect(page.getByTestId('filters-panel')).toBeVisible();
    await page.waitForTimeout(500);
    await pushPolarisToRightEdge(page, size);

    const search = await box(hud(page, 'search'), 'search');
    const stack = await box(hud(page, 'bottom-stack'), 'bottom-stack');
    const music = await box(hud(page, 'music-player'), 'music-player');
    expectDisjoint([
      ['search', search],
      ['bottom-stack', stack],
      ['music-player', music],
    ]);

    const card = await box(page.getByTestId('selection-card'), 'selection-card');
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(size.width);
    expect(card.y).toBeGreaterThanOrEqual(search.y + search.height - 0.5);
    expect(card.y + card.height).toBeLessThanOrEqual(Math.min(stack.y, music.y) + 0.5);
  });

  test(`${label} system view: header, both panels, time bar, dock panel and dock stay apart`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openApp(page);
    const input = page.getByTestId('search-input');
    await input.fill('trappist');
    await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
    await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
    await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();
    await expect(page.getByTestId('planet-panel')).toBeVisible();
    await page.getByTestId('card-mode-advanced').click();
    await page.getByTestId('options-toggle').click();
    await expect(page.getByTestId('dock-panel')).toBeVisible();
    await page.waitForTimeout(1_300); // the follow tween moves the card on screen

    const header = await box(hud(page, 'system-header'), 'system-header');
    const left = await box(page.getByTestId('system-star-panel'), 'system-star-panel');
    const right = await box(page.getByTestId('planet-list'), 'planet-list');
    const time = await box(page.getByTestId('time-scale'), 'time-scale');
    const dockPanel = await box(page.getByTestId('dock-panel'), 'dock-panel');
    const dock = await box(page.getByTestId('dock'), 'dock');
    const music = await box(hud(page, 'music-player'), 'music-player');
    expectDisjoint([
      ['system-header', header],
      ['system-star-panel', left],
      ['planet-list', right],
      ['time-scale', time],
      ['dock-panel', dockPanel],
      ['dock', dock],
      ['music-player', music],
    ]);

    const card = await box(page.getByTestId('planet-panel'), 'planet-panel');
    expect(card.x).toBeGreaterThanOrEqual(left.x + left.width - 0.5);
    expect(card.x + card.width).toBeLessThanOrEqual(right.x + 0.5);
    expect(card.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5);
    expect(card.y + card.height).toBeLessThanOrEqual(Math.min(dockPanel.y, time.y, music.y) + 0.5);
  });
}
