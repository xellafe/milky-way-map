/**
 * M7 acceptance (SPEC §6.7): System View for TRAPPIST-1 (7 planets, real
 * inclinations) and Proxima Cen (2 planets, NO inclination → schematic
 * orbits); animation at the correct periods driven by the shared time scale;
 * habitable-zone toggle (√L model, same as the pipeline in_hz flags).
 * Uses the ?pdb=1 __system bridge for angles/time and the fixture data for
 * expected values.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

interface SystemBridge {
  tDays: number;
  timeScale: number;
  hz: { innerAU: number; outerAU: number } | null;
  planets: {
    name: string;
    schematic: boolean;
    semiMajorAxisAU: number;
    periodDays: number | null;
    angleDeg: number;
  }[];
}

const bridge = (page: Page) =>
  page.evaluate(
    () => (globalThis as Record<string, unknown>).__system as never,
  ) as Promise<SystemBridge>;

const fixturePlanets = (host: string) => {
  const data = JSON.parse(readFileSync(path.join(FIXTURES, 'exoplanets.json'), 'utf-8')) as {
    hosts: Record<
      string,
      { st_lum: number | null; planets: { pl_name: string; pl_orbper: number | null }[] }
    >;
  };
  return data.hosts[host]!;
};

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function enterSystem(page: Page, query: string, optionText: string) {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill(query);
  await page.getByRole('option').filter({ hasText: optionText }).first().click();
  const button = page.getByTestId('view-system-button');
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByTestId('system-title')).toHaveText(optionText);
  await expect.poll(async () => (await bridge(page)) !== undefined).toBe(true);
}

test('TRAPPIST-1: 7 planets animated at the correct periods (real inclinations)', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  const s1 = await bridge(page);
  expect(s1.planets).toHaveLength(7);
  // pl_orbincl is present for all TRAPPIST planets → real (non-schematic) orbits.
  expect(s1.planets.every((p) => !p.schematic)).toBe(true);

  // Animation: the default shared scale is 2 simulated days per real second.
  await page.waitForTimeout(1_000);
  const s2 = await bridge(page);
  expect(s2.timeScale).toBe(2);
  expect(s2.tDays - s1.tDays).toBeGreaterThan(0.8); // ≥0.4 s of real time
  expect(s2.tDays - s1.tDays).toBeLessThan(10);

  // Period correctness: each angle must match the phase implied by tDays
  // and the catalog period (small Kepler deviation allowed: e ≈ 0).
  const expected = fixturePlanets('TRAPPIST-1');
  for (const planet of s2.planets) {
    const period = expected.planets.find((p) => p.pl_name === planet.name)!.pl_orbper!;
    expect(planet.periodDays).toBeCloseTo(period, 6);
    const phaseDeg = ((s2.tDays % period) / period) * 360;
    const diff = Math.abs(((planet.angleDeg - phaseDeg + 540) % 360) - 180);
    expect(diff).toBeLessThan(8);
  }
});

test('time controls: pause freezes the simulation, the slider changes the scale', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  await page.getByTestId('time-pause').click();
  const paused1 = await bridge(page);
  expect(paused1.timeScale).toBe(0);
  await page.waitForTimeout(500);
  const paused2 = await bridge(page);
  expect(paused2.tDays).toBe(paused1.tDays);

  await page.getByTestId('time-pause').click(); // resume
  await page.getByTestId('time-slider').fill('1000'); // max → 365 days/s
  await expect.poll(async () => (await bridge(page)).timeScale).toBeGreaterThan(300);
  await expect.poll(async () => (await bridge(page)).tDays).toBeGreaterThan(paused2.tDays + 50);
});

test('habitable zone: toggle shows the √L ring consistent with the in_hz flags', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  const litPixels = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i]! > 8 || pixels[i + 1]! > 8 || pixels[i + 2]! > 8) lit++;
      }
      return lit;
    });

  await page.waitForTimeout(300);
  const before = await litPixels();
  await page.getByTestId('toggle-hz').check();
  await expect.poll(litPixels, { timeout: 5_000 }).toBeGreaterThan(before * 1.5);

  // Bounds follow the pipeline model: log L → ring straddling planet e
  // (in_hz=true in the fixture) and excluding planet b (in_hz=false).
  const s = await bridge(page);
  const lum = 10 ** fixturePlanets('TRAPPIST-1').st_lum!;
  expect(s.hz!.innerAU).toBeCloseTo(Math.sqrt(lum / 1.1), 6);
  expect(s.hz!.outerAU).toBeCloseTo(Math.sqrt(lum / 0.53), 6);
  const byName = Object.fromEntries(s.planets.map((p) => [p.name, p.semiMajorAxisAU]));
  expect(byName['TRAPPIST-1 e']!).toBeGreaterThanOrEqual(s.hz!.innerAU);
  expect(byName['TRAPPIST-1 e']!).toBeLessThanOrEqual(s.hz!.outerAU);
  expect(byName['TRAPPIST-1 b']!).toBeLessThan(s.hz!.innerAU);

  await page.getByTestId('toggle-hz').uncheck();
  await expect.poll(litPixels, { timeout: 5_000 }).toBeLessThan(before * 1.5);
});

test('Proxima Cen: schematic orbits without inclination + planet details panel', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'proxima cen', 'Proxima Cen');

  const s = await bridge(page);
  expect(s.planets).toHaveLength(2);
  // No pl_orbincl in the fixture for either planet → schematic orbits (AC).
  expect(s.planets.every((p) => p.schematic)).toBe(true);

  // Planet details via the keyboard-reachable chip list (SPEC §6.7 fields).
  await page.getByTestId('planet-chip').filter({ hasText: 'Proxima Cen b' }).click();
  const panel = page.getByTestId('planet-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('planet-panel-title')).toHaveText('Proxima Cen b');
  await expect(panel).toContainText('11.18'); // orbital period, days
  await expect(panel).toContainText('0.04848'); // semi-major axis, AU
  await expect(panel).toContainText('Radial Velocity');
});

test('back button returns to the galaxy with the selection intact', async ({ page }) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  await page.getByTestId('system-back').click();
  await expect(page.getByTestId('search-input')).toBeVisible();
  await expect(page.getByTestId('star-panel')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('TRAPPIST-1');
  await expect(page.getByTestId('system-title')).toHaveCount(0);
});

test('planet type filter hides planets and their chips (TRAPPIST-1: all rocky)', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  await expect(page.getByTestId('planet-chip')).toHaveCount(7);
  await page.getByTestId('planet-type-rocky').uncheck();
  await expect(page.getByTestId('planet-chip')).toHaveCount(0);
  await expect.poll(async () => (await bridge(page)).planets.length).toBe(0);

  await page.getByTestId('planet-type-rocky').check();
  await expect.poll(async () => (await bridge(page)).planets.length).toBe(7);
  await page.getByTestId('planet-chip').first().click();
  await expect(page.getByTestId('planet-panel')).toContainText('Rocky');
});

test('orbit style: each style renders and the choice persists', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  const select = page.getByTestId('orbit-style');
  await expect(select).toHaveValue('trail');
  for (const style of ['thick', 'simple', 'trail']) {
    await select.selectOption(style);
    await page.waitForTimeout(300);
    await expect(page.locator('canvas')).toBeVisible();
  }
  await select.selectOption('thick');
  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('orbit-style')).toHaveValue('thick');
  expect(errors.filter((e) => /shader|WebGL|THREE/i.test(e))).toEqual([]);
});
