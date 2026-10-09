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
import type { Lim } from '../../src/lib/limitedValue';
import { orbitSense } from '../../src/lib/orbitSense';
import { planetComposition } from '../../src/lib/planetComposition';
import { readFixtureExoplanets, serveFixtureData, serveMutatedExoplanets } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

interface SystemBridge {
  tDays: number;
  timeScale: number;
  hz: { innerAU: number; outerAU: number; inclinationDeg: number | null } | null;
  cameraTarget: [number, number, number];
  viewShiftPx: number;
  planets: {
    name: string;
    position: [number, number, number];
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
      {
        st_lum: number | null;
        planets: { pl_name: string; pl_orbper: number | null; pl_orbincl: number | null }[];
      }
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
  // #23: unanchored hosts (TRAPPIST-1) open the System View straight from the search;
  // anchored ones go through the card button.
  if (optionText !== 'TRAPPIST-1') {
    const button = page.getByTestId('view-system-button');
    await expect(button).toBeEnabled({ timeout: 10_000 });
    await button.click();
  }
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
  await page.getByTestId('view-toggle').click();
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

test('habitable zone: ring plane follows the median orbital inclination, no console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  await page.getByTestId('view-toggle').click();
  await page.getByTestId('toggle-hz').check();
  await page.waitForTimeout(500);

  const incl = fixturePlanets('TRAPPIST-1')
    .planets.map((p) => p.pl_orbincl)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const mid = incl.length >> 1;
  const median = incl.length % 2 ? incl[mid]! : (incl[mid - 1]! + incl[mid]!) / 2;
  const s = await bridge(page);
  expect(s.hz!.inclinationDeg).toBeCloseTo(median, 6);

  await page.getByTestId('toggle-hz').uncheck();
  expect(errors).toEqual([]);
});

test('habitable zone: gradient is warmer at the inner edge than at the outer edge', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);
  // Proxima Cen has no inclination → the ring is flat in XZ, whose projection
  // is known from the fixed initial camera (see samplePoints below).
  await enterSystem(page, 'proxima cen', 'Proxima Cen');
  await page.getByTestId('time-slider').fill('0'); // paused: planets must not move between shots
  await page.waitForTimeout(300);

  const s = await bridge(page);
  const maxA = Math.max(...s.planets.map((p) => p.semiMajorAxisAU));
  const { innerAU, outerAU } = s.hz!;

  // Sample points: ring-plane points at t = 0.2 (inner) and t = 0.8 (outer) of
  // the radial span, at 12 azimuths, projected to the drawing buffer with the
  // known initial camera: position maxA·(1.7, 1.1, 1.7), looking at the
  // origin, fov 50° vertical. Each pixel is compared HZ-on vs HZ-off and
  // pixels already lit with HZ off (planets, orbits, star) are discarded, so
  // the on−off difference is the ring colour alone.
  const sample = () =>
    page.evaluate(
      ({ maxA, innerAU, outerAU }) => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
        const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const cam = [maxA * 1.7, maxA * 1.1, maxA * 1.7];
        const norm = (v: number[]) => v.map((x) => x / Math.hypot(...v));
        const cross = (a: number[], b: number[]) => [
          a[1]! * b[2]! - a[2]! * b[1]!,
          a[2]! * b[0]! - a[0]! * b[2]!,
          a[0]! * b[1]! - a[1]! * b[0]!,
        ];
        const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
        const fwd = norm(cam.map((x) => -x));
        const right = norm(cross(fwd, [0, 1, 0]));
        const up = cross(right, fwd);
        const tanHalf = Math.tan((50 * Math.PI) / 360);
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const out: Record<'inner' | 'outer', number[][]> = { inner: [], outer: [] };
        for (const [key, t] of [
          ['inner', 0.2],
          ['outer', 0.8],
        ] as const) {
          const r = innerAU + t * (outerAU - innerAU);
          for (let k = 0; k < 12; k++) {
            const th = (k / 12) * 2 * Math.PI;
            const d = [r * Math.cos(th) - cam[0]!, -cam[1]!, r * Math.sin(th) - cam[2]!];
            const z = dot(d, fwd);
            const nx = dot(d, right) / (z * tanHalf * aspect);
            const ny = dot(d, up) / (z * tanHalf);
            const px = Math.round(((nx + 1) / 2) * w);
            const py = Math.round(((ny + 1) / 2) * h);
            if (px < 0 || px >= w || py < 0 || py >= h) continue;
            const i = (py * w + px) * 4;
            out[key].push([pixels[i]!, pixels[i + 1]!, pixels[i + 2]!]);
          }
        }
        return out;
      },
      { maxA, innerAU, outerAU },
    );

  const off = await sample();
  await page.getByTestId('view-toggle').click();
  await page.getByTestId('toggle-hz').check();

  // Mean red-minus-blue gain of the ring over the HZ-off frame; null until
  // the shader has compiled and enough clean sample pixels show the ring.
  const warmth = (on: Awaited<ReturnType<typeof sample>>, key: 'inner' | 'outer') => {
    const diffs = on[key]
      .map((p, i) => ({ p, o: off[key][i]! }))
      .filter(({ o }) => o.every((c) => c <= 8))
      .map(({ p, o }) => p[0]! - o[0]! - (p[2]! - o[2]!));
    return diffs.length >= 6 ? diffs.reduce((x, y) => x + y, 0) / diffs.length : null;
  };
  await expect
    .poll(
      async () => {
        const on = await sample();
        const inner = warmth(on, 'inner');
        const outer = warmth(on, 'outer');
        return inner !== null && outer !== null && inner > outer;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  expect(errors).toEqual([]);
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
  await expect(panel).toContainText('11.18'); // orbital period tile (Base), days
  // #23: semi-major axis and method moved to the Advanced columns of the card.
  await page.getByTestId('card-mode-advanced').click();
  await expect(panel).toContainText('0.04848'); // semi-major axis, AU
  await expect(panel).toContainText('Radial Velocity');
});

test('back button returns to the galaxy with the selection intact', async ({ page }) => {
  await openApp(page);
  // #23: Proxima Cen (anchored) keeps its card; TRAPPIST-1 has none to keep.
  await enterSystem(page, 'proxima cen', 'Proxima Cen');

  await page.getByTestId('system-back').click();
  await expect(page.getByTestId('search-input')).toBeVisible();
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toContainText('Proxima');
  await expect(page.getByTestId('system-title')).toHaveCount(0);
});

test('planet type filter hides planets and their chips (TRAPPIST-1: all rocky)', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  await expect(page.getByTestId('planet-chip')).toHaveCount(7);
  await page.getByTestId('view-toggle').click();
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

  await page.getByTestId('view-toggle').click();
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
  await page.getByTestId('view-toggle').click();
  await expect(page.getByTestId('orbit-style')).toHaveValue('thick');
  expect(errors.filter((e) => /shader|WebGL|THREE/i.test(e))).toEqual([]);
});

test('time bar stays visible below the open dock panel', async ({ page }) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('dock-panel')).toBeVisible();
  await expect(page.getByTestId('time-scale')).toBeVisible();
  const p = (await page.getByTestId('dock-panel').boundingBox())!;
  const t = (await page.getByTestId('time-scale').boundingBox())!;
  const overlap =
    p.x < t.x + t.width && p.x + p.width > t.x && p.y < t.y + t.height && p.y + p.height > t.y;
  expect(overlap).toBe(false);
  expect(t.y).toBeGreaterThanOrEqual(p.y + p.height);
});

// --- Advanced planet data (#18) -----------------------------------------------
const EN = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../src/i18n/locales/en.json', import.meta.url)), 'utf-8'),
) as { system: Record<string, Record<string, string> | string> };
const enLabel = (group: string, key: string): string => {
  const v = (EN.system[group] as Record<string, string> | undefined)?.[key];
  expect(v, `en.json system.${group}.${key}`).toBeTruthy();
  return v!;
};
const sig3 = (v: number) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(v);
// Literal on purpose: pins the user-visible English wording of each provenance.
const MASS_PROV_EN: Record<string, string> = {
  Mass: 'Measured',
  Msini: 'Minimum (M sin i)',
  'Msin(i)/sin(i)': 'Derived from M sin i and inclination',
  'M-R relationship': 'Estimated (mass-radius relation)',
};

type Planet = Record<string, number | string | null>;
const planetOf = (host: string, name: string) =>
  readFixtureExoplanets().hosts[host]!.planets.find((p) => p['pl_name'] === name) as Planet;

// #23: the planet details live in the anchored card; Advanced rows need the mode toggle.
async function openPlanetAdvanced(page: Page, chip: string) {
  await page.getByTestId('planet-chip').filter({ hasText: chip }).click();
  await expect(page.getByTestId('planet-panel')).toBeVisible();
  await page.getByTestId('card-mode-advanced').click();
  const section = page.getByTestId('planet-panel').getByTestId('card-advanced');
  await expect(section).toBeVisible();
  return section;
}

test('TRAPPIST-1 b: advanced planet data from the fixture, composition model note', async ({
  page,
}) => {
  const p = planetOf('TRAPPIST-1', 'TRAPPIST-1 b');
  const comp = planetComposition(
    p['pl_bmasse'] as number,
    p['pl_rade'] as number,
    p['pl_bmassprov'] as string,
    p['pl_bmasselim'] as Lim,
    p['pl_radelim'] as Lim,
  );
  const sense = orbitSense(
    p['pl_trueobliq'] as number | null,
    p['pl_trueobliqlim'] as Lim,
    p['pl_projobliq'] as number | null,
    p['pl_projobliqlim'] as Lim,
  );
  expect(comp).not.toBeNull();
  expect(sense).not.toBeNull();

  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  const section = await openPlanetAdvanced(page, 'TRAPPIST-1 b');

  await expect(section.getByTestId('adv-pl_dens')).toContainText(sig3(p['pl_dens'] as number));
  await expect(section.getByTestId('adv-pl_insol')).toContainText(sig3(p['pl_insol'] as number));
  await expect(section.getByTestId('adv-mass-prov')).toContainText(
    MASS_PROV_EN[p['pl_bmassprov'] as string]!,
  );
  const compRow = section.getByTestId('adv-composition');
  await expect(compRow).toContainText(enLabel('composition', comp!));
  const note = EN.system['compositionNote'];
  expect(note, 'en.json system.compositionNote').toBeTruthy();
  await expect(section.getByTestId('adv-composition-note')).toHaveText(note as string);
  await expect(section.getByTestId('adv-orbit-sense').locator('dt')).toHaveText(
    'Orbit vs. stellar spin',
  );
  await expect(section.getByTestId('adv-orbit-sense')).toContainText(enLabel('orbitSense', sense!));
});

test('composition class labels do not overstate the water class', () => {
  expect(enLabel('composition', 'water')).toBe('Water-rich');
});

test('TRAPPIST-1 c: no obliquity in the fixture -> orbit sense n/a', async ({ page }) => {
  const p = planetOf('TRAPPIST-1', 'TRAPPIST-1 c');
  expect(p['pl_projobliq']).toBeNull();
  expect(p['pl_trueobliq']).toBeNull();
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  const section = await openPlanetAdvanced(page, 'TRAPPIST-1 c');
  await expect(section.getByTestId('adv-orbit-sense').locator('dd')).toContainText('n/a');
});

test('Proxima Cen d: Msini mass provenance, composition n/a without a note', async ({ page }) => {
  const p = planetOf('Proxima Cen', 'Proxima Cen d');
  expect(p['pl_bmassprov']).toBe('Msini');
  await openApp(page);
  await enterSystem(page, 'proxima cen', 'Proxima Cen');
  const section = await openPlanetAdvanced(page, 'Proxima Cen d');
  await expect(section.getByTestId('adv-pl_dens')).toContainText(sig3(p['pl_dens'] as number));
  await expect(section.getByTestId('adv-mass-prov')).toContainText(MASS_PROV_EN['Msini']!);
  await expect(section.getByTestId('adv-composition').locator('dd')).toContainText('n/a');
  await expect(section.getByTestId('adv-composition-note')).toHaveCount(0);
});

test('planet limit flag prefixes density with < ', async ({ page }) => {
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const pl = d.hosts['TRAPPIST-1']!.planets.find((q) => q['pl_name'] === 'TRAPPIST-1 b')!;
    pl['pl_denslim'] = 1;
  });
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  const section = await openPlanetAdvanced(page, 'TRAPPIST-1 b');
  const p = planetOf('TRAPPIST-1', 'TRAPPIST-1 b');
  await expect(section.getByTestId('adv-pl_dens').locator('dd')).toHaveText(
    new RegExp(`^<\\s?${sig3(p['pl_dens'] as number).replace('.', '\\.')}`),
  );
});

test('legacy exoplanets.json (new fields absent): planet section shows only n/a, no errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const planetNew = /^pl_(dens|insol|bmassprov|projobliq|trueobliq)/;
    for (const h of Object.values(d.hosts))
      for (const pl of h.planets)
        for (const k of Object.keys(pl)) if (planetNew.test(k)) delete pl[k];
  });
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  const section = await openPlanetAdvanced(page, 'TRAPPIST-1 b');
  for (const id of [
    'adv-pl_dens',
    'adv-pl_insol',
    'adv-mass-prov',
    'adv-composition',
    'adv-orbit-sense',
  ])
    await expect(section.getByTestId(id).locator('dd')).toContainText('n/a');
  expect(errors).toEqual([]);
});

test('camera follows the selected planet', async ({ page }) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();
  await page.waitForTimeout(1_500); // approach tween (1 s) done

  const sample = async () => {
    const s = await bridge(page);
    return { target: s.cameraTarget, planet: s.planets.find((p) => p.name === 'TRAPPIST-1 b')! };
  };
  const first = await sample();
  await page.waitForTimeout(500);
  const second = await sample();

  const dist = (a: number[], b: number[]) =>
    Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  expect(dist(first.target, first.planet.position)).toBeLessThan(1e-6);
  expect(dist(second.target, second.planet.position)).toBeLessThan(1e-6);
  expect(dist(first.target, second.target)).toBeGreaterThan(0); // the planet moves

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('planet-panel')).toHaveCount(0);
  const still1 = (await bridge(page)).cameraTarget;
  await page.waitForTimeout(500);
  const still2 = (await bridge(page)).cameraTarget;
  expect(dist(still1, still2)).toBe(0);
});

// --- Planet card with gauges (#23) -----------------------------------------------
test('planet card: Base shows the four stat tiles with the fixture values', async ({ page }) => {
  const p = planetOf('TRAPPIST-1', 'TRAPPIST-1 b');
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();

  const card = page.getByTestId('planet-panel');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-mode', 'base');
  await expect(page.getByTestId('planet-panel-title')).toHaveText('TRAPPIST-1 b');
  await expect(card.getByTestId('stat-radius')).toContainText(sig3(p['pl_rade'] as number));
  await expect(card.getByTestId('stat-mass')).toContainText(sig3(p['pl_bmasse'] as number));
  await expect(card.getByTestId('stat-period')).toContainText(sig3(p['pl_orbper'] as number));
  await expect(card.getByTestId('stat-eqt')).toContainText(sig3(p['pl_eqt'] as number));
  // in_hz is false for planet b in the fixture.
  expect(p['in_hz']).toBe(false);
  const inHzNo = EN.system['inHzNo'];
  expect(inHzNo, 'en.json system.inHzNo').toBeTruthy();
  await expect(card.getByTestId('stat-eqt-verdict')).toHaveText(inHzNo as string);
  await expect(card).toContainText('Rocky');
  await expect(page.getByTestId('card-advanced')).toHaveCount(0);
});

test('planet card: Advanced mode shows the composition note', async ({ page }) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  const section = await openPlanetAdvanced(page, 'TRAPPIST-1 b');
  await expect(section.getByTestId('adv-composition-note')).toBeVisible();
});

test('once following, the planet moves in the world but the card anchor stays put on screen', async ({
  page,
}) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();
  await expect(page.getByTestId('planet-panel')).toBeVisible();
  // The overlay is the anchor: its transform is rewritten every frame.
  const anchor = page.getByTestId('selection-overlay');
  await expect(anchor).toHaveCount(1);
  await expect(anchor).toHaveCSS('visibility', 'visible');
  await page.waitForTimeout(1_800); // approach (1 s) and view shift slide are over
  const position = async () =>
    (await bridge(page)).planets.find((p) => p.name === 'TRAPPIST-1 b')!.position;
  const p1 = await position();
  await page.waitForTimeout(500);
  const p2 = await position();
  expect(p2, 'the planet moves in the world').not.toEqual(p1);

  const vp = page.viewportSize()!;
  const shift = (await bridge(page)).viewShiftPx;
  const style = await anchor.evaluate((el) => (el as HTMLElement).style.transform);
  const m = /^translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style);
  expect(m, style).not.toBeNull();
  expect(Math.abs(Number(m![1]) - (vp.width / 2 - shift))).toBeLessThanOrEqual(1);
  expect(Math.abs(Number(m![2]) - vp.height / 2)).toBeLessThanOrEqual(1);
});

test('planet without pl_orbsmax: card beside the panel, no ring, no console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const pl = d.hosts['TRAPPIST-1']!.planets.find((q) => q['pl_name'] === 'TRAPPIST-1 b')!;
    pl['pl_orbsmax'] = null;
  });
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  await page.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' }).click();

  await expect(page.getByTestId('planet-panel')).toBeVisible();
  await expect(page.getByTestId('planet-no-position')).toBeVisible();
  await expect(page.locator('[data-hud="selection-ring"]')).toHaveCount(0);
  const card = (await page.getByTestId('planet-panel').boundingBox())!;
  const side = await page.locator('[data-hud="side-panel-right"]').boundingBox();
  expect(side, 'side-panel-right must be present').not.toBeNull();
  expect(card.x + card.width).toBeLessThanOrEqual(side!.x + 1);
  expect(errors).toEqual([]);
});

// --- Two-panel layout: star panel (left) and planet list (right) (#23) -------------
const starPanel = (page: Page) => page.getByTestId('system-star-panel');

test('TRAPPIST-1: unanchored badge and catalog stat tiles live in the left panel', async ({
  page,
}) => {
  const host = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');

  const panel = starPanel(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('not-anchored-badge')).toBeVisible();
  await expect(
    page.locator('[data-hud="system-header"]').getByTestId('not-anchored-badge'),
  ).toHaveCount(0);
  await expect(panel.getByTestId('stat-teff')).toContainText(sig3(host['st_teff'] as number));
  await expect(panel.getByTestId('stat-luminosity')).toContainText(
    sig3(10 ** (host['st_lum'] as number)),
  );
  await expect(panel.getByTestId('stat-stellar-radius')).toContainText(
    sig3(host['st_rad'] as number),
  );
  // Unanchored: no star-cloud data, so no distance tile.
  await expect(panel.getByTestId('stat-distance')).toHaveCount(0);
});

test('Proxima Cen: anchored host shows the star stat tiles in the left panel', async ({ page }) => {
  await openApp(page);
  await enterSystem(page, 'proxima cen', 'Proxima Cen');
  const panel = starPanel(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('stat-distance')).toContainText(/\d/);
  await expect(panel.getByTestId('stat-distance')).toContainText('ly');
  await expect(panel.getByTestId('not-anchored-badge')).toHaveCount(0);
});

test('planet list: one chip per planet, pressed state follows the selection', async ({ page }) => {
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  const list = page.getByTestId('planet-list');
  await expect(list).toBeVisible();
  await expect(list.getByTestId('planet-chip')).toHaveCount(7);
  const b = list.getByTestId('planet-chip').filter({ hasText: 'TRAPPIST-1 b' });
  await b.click();
  await expect(b).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('planet-panel-title')).toHaveText('TRAPPIST-1 b');
});

// --- Host-star archive rows, read from TRAPPIST-1's own left panel (#18, #23) -----
const archiveValue = (page: Page, field: string) =>
  starPanel(page).getByTestId(`adv-${field}`).locator('dd');
const ARCHIVE_FIELDS = [
  'st_met',
  'st_age',
  'st_mass',
  'st_logg',
  'st_spectype',
  'st_rotp',
  'st_vsin',
];

async function enterTrappistWith(page: Page, mutate?: (h: Record<string, unknown>) => void) {
  await serveFixtureData(page);
  if (mutate) await serveMutatedExoplanets(page, (d) => mutate(d.hosts['TRAPPIST-1']!));
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
}

test('archive rows show the TRAPPIST-1 fixture values', async ({ page }) => {
  const host = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await enterTrappistWith(page);
  for (const f of ARCHIVE_FIELDS) {
    const v = host[f] as number | string | null;
    const dd = archiveValue(page, f);
    if (v === null) await expect(dd).toContainText('n/a');
    else if (typeof v === 'string') await expect(dd).toContainText(v);
    else await expect(dd).toContainText(sig3(v));
  }
});

test('archive rows: metallicity label carries the archive ratio ([Fe/H] from the fixture)', async ({
  page,
}) => {
  const host = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await enterTrappistWith(page);
  await expect(starPanel(page).getByTestId('adv-st_met')).toContainText(
    host['st_metratio'] as string,
  );
});

test('archive rows: [M/H] ratio label', async ({ page }) => {
  const host = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await enterTrappistWith(page, (h) => {
    h['st_metratio'] = '[M/H]';
  });
  const row = starPanel(page).getByTestId('adv-st_met');
  await expect(row).toContainText('[M/H]');
  await expect(row.locator('dd')).toContainText(sig3(host['st_met'] as number));
});

test('archive rows: plain "Metallicity" label when st_metratio is absent', async ({ page }) => {
  const host = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await enterTrappistWith(page, (h) => {
    h['st_metratio'] = null;
  });
  const row = starPanel(page).getByTestId('adv-st_met');
  await expect(row.locator('dt')).toHaveText('Metallicity');
  await expect(row.locator('dd')).toContainText(sig3(host['st_met'] as number));
});

test('archive rows: limit flags prefix the value with < or >', async ({ page }) => {
  const h = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await enterTrappistWith(page, (m) => {
    m['st_agelim'] = 1;
    m['st_masslim'] = -1;
  });
  const starts = (prefix: string, v: unknown) =>
    new RegExp(`^${prefix}\\s?${sig3(v as number).replace(/[.]/g, '\\.')}`);
  await expect(archiveValue(page, 'st_age')).toHaveText(starts('<', h['st_age']));
  await expect(archiveValue(page, 'st_mass')).toHaveText(starts('>', h['st_mass']));
  await expect(archiveValue(page, 'st_met')).toHaveText(starts('', h['st_met']));
});

test('archive rows: v sin i is labelled as a projected rotation speed', async ({ page }) => {
  await enterTrappistWith(page);
  await expect(starPanel(page).getByTestId('adv-st_vsin').locator('dt')).toHaveText(
    'Projected rotation speed (v sin i)',
  );
});

test('archive rows: metallicity and log g carry their units', async ({ page }) => {
  await enterTrappistWith(page);
  await expect(archiveValue(page, 'st_met')).toContainText('dex');
  await expect(archiveValue(page, 'st_logg')).toContainText('cgs');
});

test('legacy exoplanets.json (new host fields absent): archive rows read n/a, no errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const hostNew = /^st_(met|age|mass|logg|spectype|rotp|vsin)/;
    for (const h of Object.values(d.hosts))
      for (const k of Object.keys(h)) if (hostNew.test(k)) delete h[k];
  });
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  for (const f of ARCHIVE_FIELDS) await expect(archiveValue(page, f)).toContainText('n/a');
  expect(errors).toEqual([]);
});

// --- Projection shift that keeps the Advanced card on screen (#23) -----------------
test('1280x720: Advanced card shifts the view, kept after Esc', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  expect((await bridge(page)).viewShiftPx).toBe(0);

  await openPlanetAdvanced(page, 'TRAPPIST-1 b');
  await page.waitForTimeout(1_500);
  const shifted = (await bridge(page)).viewShiftPx;
  expect(shifted).toBeGreaterThan(0);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('planet-panel')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect((await bridge(page)).viewShiftPx).toBe(shifted);
});

test('1920x1080: Advanced card needs no view shift', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page);
  await enterSystem(page, 'trappist', 'TRAPPIST-1');
  await openPlanetAdvanced(page, 'TRAPPIST-1 b');
  await page.waitForTimeout(1_500);
  expect((await bridge(page)).viewShiftPx).toBe(0);
});
