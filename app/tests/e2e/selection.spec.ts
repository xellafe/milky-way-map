/**
 * M3 acceptance: selecting Polaris (via search AND via click) and TRAPPIST-1
 * (via search — it is NOT in the cloud: matched:false, SPEC §5.3) shows
 * correct data. Expected values are read from the golden fixture itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  readFixtureExoplanets,
  serveFixtureData,
  serveMutatedExoplanets,
  waitForFlyToArrival,
} from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

interface FixtureStar {
  index: number;
  distanceLy: number;
  appMag: number;
  spectralClass: number;
  luminosity: number;
}

function readFixtureStar(properName: string): FixtureStar {
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
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const attr = (name: string) => manifest.attributes.find((a) => a.name === name)!;
  const f32 = (name: string) => new Float32Array(buf, attr(name).byteOffset, manifest.count);
  const u8 = (name: string) => new Uint8Array(buf, attr(name).byteOffset, manifest.count);

  return {
    index,
    distanceLy: f32('distanceLy')[index]!,
    appMag: f32('appMag')[index]!,
    spectralClass: u8('spectralClass')[index]!,
    luminosity: f32('luminosity')[index]!,
  };
}

const SPECTRAL = 'OBAFGKM';
const enNumber = (v: number, digits: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v);
const enSignificant = (v: number, digits: number) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(v);

test('Polaris via search shows correct catalog data', async ({ page }) => {
  const polaris = readFixtureStar('Polaris');
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();

  const panel = page.getByTestId('selection-card');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-mode', 'base');
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
  await expect(panel).toContainText(`${enNumber(polaris.distanceLy, 1)} ly`);
  await expect(panel).toContainText(enNumber(polaris.appMag, 2));
  await expect(panel).toContainText(SPECTRAL[polaris.spectralClass]!);
});

test('Polaris card: four stat tiles with gauges, no planets UI', async ({ page }) => {
  const polaris = readFixtureStar('Polaris');
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();

  // #23: one card only, so each stat tile exists exactly once in the document (AC1).
  const panel = page.getByTestId('selection-card');
  const tile = (id: string) => panel.getByTestId(id);
  await expect(tile('stat-distance')).toBeVisible();
  await expect(tile('stat-distance')).toContainText(`${enNumber(polaris.distanceLy, 1)} ly`);
  await expect(tile('stat-teff')).toBeVisible();
  await expect(tile('stat-teff')).toContainText(/≈\s*[\d,]+\s*K/);
  await expect(tile('stat-teff')).toContainText(/estimate/i);
  await expect(tile('stat-luminosity')).toBeVisible();
  await expect(tile('stat-luminosity')).toContainText(enSignificant(polaris.luminosity, 3));
  await expect(tile('stat-appmag')).toBeVisible();
  await expect(tile('stat-appmag')).toContainText(enNumber(polaris.appMag, 2));

  for (const id of ['stat-distance', 'stat-teff', 'stat-luminosity', 'stat-appmag']) {
    await expect(page.locator(`[data-testid="${id}"]`)).toHaveCount(1);
  }

  // Each tile exposes its gauge as a meter with a text alternative.
  for (const id of ['stat-distance', 'stat-teff', 'stat-luminosity', 'stat-appmag']) {
    const meter = tile(id).getByRole('meter');
    await expect(meter).toHaveAttribute('aria-valuemin', '0');
    await expect(meter).toHaveAttribute('aria-valuemax', '1');
    await expect(meter).toHaveAttribute('aria-valuenow', /^\d/);
    await expect(meter).toHaveAttribute('aria-valuetext', /\S/);
  }

  // Regression: HUD panels must not create horizontal overflow (a 1 px
  // scrollbar) in scrollable panels.
  const noHScroll = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(await noHScroll('selection-card')).toBe(true);
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
  expect(await noHScroll('filters-panel')).toBe(true);

  // Polaris has no known planets: no System View button.
  await expect(panel.getByTestId('view-system-button')).toHaveCount(0);
});

test('catalog-anchored host (Proxima Cen) shows the planet count on the System View button', async ({
  page,
}) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('proxima cen');
  await page.getByRole('option').filter({ hasText: 'Proxima Cen' }).first().click();

  const panel = page.getByTestId('selection-card');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('stat-distance')).toBeVisible();
  await expect(panel.getByTestId('view-system-button')).toBeVisible();
  await expect(panel.getByTestId('view-system-button')).toContainText('2');
});

// #23 AC1/AC4: Base is the default and shows the System View entry point.
test('Proxima Cen in Base mode: one click on the button opens its System View', async ({
  page,
}) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('proxima cen');
  await page.getByRole('option').filter({ hasText: 'Proxima Cen' }).first().click();

  await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'base');
  const button = page.getByTestId('view-system-button');
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByTestId('system-title')).toHaveText('Proxima Cen');
});

// #23 AC1-AC3: Base/Advanced modes of the single star card.
test.describe('card modes', () => {
  async function selectPolaris(page: Page) {
    await serveFixtureData(page);
    await page.goto('/');
    await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
    await page.getByTestId('search-input').fill('polaris');
    await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
    await expect(page.getByTestId('selection-card')).toBeVisible();
  }

  test('Base is the default: one card, no advanced column, one distance tile', async ({ page }) => {
    await selectPolaris(page);
    await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'base');
    await expect(page.getByTestId('card-mode-base')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('card-advanced')).toHaveCount(0);
    await expect(page.locator('[data-testid="stat-distance"]')).toHaveCount(1);
    await expect(page.getByTestId('star-panel')).toHaveCount(0);
  });

  test('Advanced widens the card and adds catalog data next to the same tiles', async ({
    page,
  }) => {
    await selectPolaris(page);
    const card = page.getByTestId('selection-card');
    const baseWidth = (await card.boundingBox())!.width;

    await page.getByTestId('card-mode-advanced').click();
    await expect(card).toHaveAttribute('data-mode', 'advanced');
    await expect(page.getByTestId('card-mode-advanced')).toHaveAttribute('aria-pressed', 'true');
    const advanced = page.getByTestId('card-advanced');
    await expect(advanced).toBeVisible();
    await expect.poll(async () => (await card.boundingBox())!.width).toBeGreaterThan(400);
    expect((await card.boundingBox())!.width).toBeGreaterThan(baseWidth);

    await expect(page.locator('[data-testid="stat-distance"]')).toHaveCount(1);
    await expect(card.getByTestId('star-age')).toBeVisible();
    await expect(card).toContainText(/Catalog IDs/i);
    await expect(card).toContainText(/Variable/i);
    await expect(card).toContainText(/Multiple/i);
  });

  test('the chosen mode survives a reload and applies to a new selection', async ({ page }) => {
    await selectPolaris(page);
    await page.getByTestId('card-mode-advanced').click();
    await expect(page.getByTestId('card-advanced')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
    await page.getByTestId('search-input').fill('polaris');
    await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
    await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'advanced');
  });

  test('closing the card with the close button or Escape leaves no card', async ({ page }) => {
    await selectPolaris(page);
    await page.getByTestId('overlay-close').click();
    await expect(page.getByTestId('selection-card')).toHaveCount(0);

    await page.getByTestId('search-input').fill('polaris');
    await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
    await expect(page.getByTestId('selection-card')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('selection-card')).toHaveCount(0);
  });
});

test('Polaris via click (after fly-to centers it) shows the same panel', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Fly to Polaris via search, then deselect: the star stays screen-centered.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
  await waitForFlyToArrival(page);

  // Click the canvas center → GPU picking must select Polaris.
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

// #23: an unanchored host has no star to anchor a card to: the System View opens directly.
test('TRAPPIST-1 via search: unanchored host opens the System View, no card', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  const input = page.getByTestId('search-input');
  await input.click(); // focus triggers the lazy exoplanets.json load
  await input.fill('trappist');
  const option = page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first();
  await expect(option).toBeVisible();
  await option.click();

  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await expect(page.getByTestId('not-anchored-badge')).toBeVisible();
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
  await expect(page.getByTestId('selection-overlay')).toHaveCount(0);
});

test('hovering a star shows its name label', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Center Polaris, then hover the canvas center.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('overlay-close').click();
  await waitForFlyToArrival(page);

  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveText('Polaris', { timeout: 5_000 });
});

// Issue #3: a click on empty sky keeps the current selection (only ✕ or Esc closes the card).
test('clicking empty sky keeps the selection (card stays)', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();

  // Left-middle of the viewport: away from Polaris (centered),
  // the card, the search box and the dock. Precondition: no star hovered there.
  await page.mouse.move(250, 400);
  await page.waitForTimeout(400);
  await expect(page.getByTestId('hover-label')).toHaveCount(0);

  await page.mouse.click(250, 400);
  await page.waitForTimeout(600);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

// --- Advanced star data (#18) -------------------------------------------------
// Numbers use 3 significant digits (en); null renders as the "n/a" marker.
const sig3 = (v: number) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(v);
const trappistHost = () => readFixtureExoplanets().hosts['TRAPPIST-1']!;
// #23: the galaxy card only exists for anchored hosts. Proxima Cen stands in for
// TRAPPIST-1 here: it receives the real TRAPPIST-1 host-star fixture values (the
// fields the card renders), so the expectations still come from the golden file.
const HOST = 'Proxima Cen';
const BORROWED = /^st_/;
async function serveStarCardHost(page: Page, extra?: (h: Record<string, unknown>) => void) {
  await serveMutatedExoplanets(page, (d) => {
    const src = d.hosts['TRAPPIST-1']!;
    const dst = d.hosts[HOST]!;
    for (const k of Object.keys(src)) if (BORROWED.test(k)) dst[k] = src[k];
    extra?.(dst);
  });
}
const ADV_FIELDS = ['st_met', 'st_age', 'st_mass', 'st_logg', 'st_spectype', 'st_rotp', 'st_vsin'];

async function openAppReady(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function selectHost(page: Page, query: string, label: string) {
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: label }).first().click();
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toContainText(label);
}

/** Switches the card to Advanced (the mode starts as Base) and returns its right column. */
async function openAdvanced(page: Page) {
  await expect(page.getByTestId('selection-card')).toHaveAttribute('data-mode', 'base');
  await page.getByTestId('card-mode-advanced').click();
  const section = page.getByTestId('card-advanced');
  await expect(section).toBeVisible();
  return section;
}

const advValue = (section: Locator, field: string) =>
  section.getByTestId(`adv-${field}`).locator('dd');

test('advanced star data is hidden in Base and shows fixture values in Advanced', async ({
  page,
}) => {
  const host = trappistHost();
  await serveFixtureData(page);
  await serveStarCardHost(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  await expect(page.getByTestId('card-advanced')).toHaveCount(0);

  const section = await openAdvanced(page);
  for (const f of ADV_FIELDS) {
    const v = host[f] as number | string | null;
    const dd = advValue(section, f);
    if (v === null) await expect(dd).toContainText('n/a');
    else if (typeof v === 'string') await expect(dd).toContainText(v);
    else await expect(dd).toContainText(sig3(v));
  }
});

test('Proxima Cen own fixture: real values shown, missing fields read n/a', async ({ page }) => {
  await serveFixtureData(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const section = await openAdvanced(page);
  const host = readFixtureExoplanets().hosts[HOST]!;
  for (const f of ADV_FIELDS) {
    const v = host[f] as number | string | null;
    const dd = advValue(section, f);
    if (v === null) await expect(dd).toContainText('n/a');
    else if (typeof v === 'string') await expect(dd).toContainText(v);
    else await expect(dd).toContainText(sig3(v));
  }
});

test('advanced data: metallicity label carries the archive ratio ([Fe/H] from the fixture)', async ({
  page,
}) => {
  const host = readFixtureExoplanets().hosts['TRAPPIST-1']!;
  await serveFixtureData(page);
  await serveStarCardHost(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const section = await openAdvanced(page);
  await expect(section.getByTestId('adv-st_met')).toContainText(host['st_metratio'] as string);
});

test('advanced data: [M/H] ratio label', async ({ page }) => {
  await serveFixtureData(page);
  await serveStarCardHost(page, (h) => {
    h['st_metratio'] = '[M/H]';
  });
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const row = (await openAdvanced(page)).getByTestId('adv-st_met');
  await expect(row).toContainText('[M/H]');
  await expect(row.locator('dd')).toContainText(sig3(trappistHost()['st_met'] as number));
});

test('advanced data: plain "Metallicity" label when st_metratio is absent', async ({ page }) => {
  await serveFixtureData(page);
  await serveStarCardHost(page, (h) => {
    h['st_metratio'] = null;
  });
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const row = (await openAdvanced(page)).getByTestId('adv-st_met');
  await expect(row.locator('dt')).toHaveText('Metallicity');
  await expect(row.locator('dd')).toContainText(sig3(trappistHost()['st_met'] as number));
});

test('advanced data: limit flags prefix the value with < or >', async ({ page }) => {
  await serveFixtureData(page);
  await serveStarCardHost(page, (h) => {
    h['st_agelim'] = 1;
    h['st_masslim'] = -1;
  });
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const section = await openAdvanced(page);
  const h = trappistHost();
  const starts = (prefix: string, v: unknown) =>
    new RegExp(`^${prefix}\\s?${sig3(v as number).replace(/[.]/g, '\\.')}`);
  await expect(advValue(section, 'st_age')).toHaveText(starts('<', h['st_age']));
  await expect(advValue(section, 'st_mass')).toHaveText(starts('>', h['st_mass']));
  await expect(advValue(section, 'st_met')).toHaveText(starts('', h['st_met']));
});

test('advanced data: v sin i row is labelled as a projected rotation speed', async ({ page }) => {
  await serveFixtureData(page);
  await serveStarCardHost(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const section = await openAdvanced(page);
  await expect(section.getByTestId('adv-st_vsin').locator('dt')).toHaveText(
    'Projected rotation speed (v sin i)',
  );
});

test('advanced data: metallicity and log g carry their units', async ({ page }) => {
  await serveFixtureData(page);
  await serveStarCardHost(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const section = await openAdvanced(page);
  await expect(advValue(section, 'st_met')).toContainText('dex');
  await expect(advValue(section, 'st_logg')).toContainText('cgs');
});

test('Proxima Cen: "age" row reads only n/a when st_age is null', async ({ page }) => {
  await serveFixtureData(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', 'Proxima Cen');
  await openAdvanced(page);
  const row = page.getByTestId('selection-card').getByTestId('star-age');
  await expect(row).toContainText('n/a');
  await expect(row).not.toContainText('uncertain estimate');
});

test('Proxima Cen: "age" row shows st_age with unit and the uncertainty note', async ({ page }) => {
  // Real fixture value borrowed from another host; Proxima Cen has none of its own.
  const age = readFixtureExoplanets().hosts['TRAPPIST-1']!['st_age'] as number;
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const h = d.hosts['Proxima Cen']!;
    h['st_age'] = age;
    h['st_agelim'] = 0;
  });
  await openAppReady(page);
  await selectHost(page, 'proxima cen', 'Proxima Cen');
  await openAdvanced(page);
  const row = page.getByTestId('selection-card').getByTestId('star-age');
  await expect(row).toContainText(sig3(age));
  await expect(row).toContainText('Gyr');
  await expect(row).toContainText('uncertain estimate');
});

test('legacy exoplanets.json (new fields absent): section shows only n/a, no errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await serveFixtureData(page);
  await serveMutatedExoplanets(page, (d) => {
    const hostNew = /^st_(met|age|mass|logg|spectype|rotp|vsin)/;
    const planetNew = /^pl_(dens|insol|bmassprov|projobliq|trueobliq)/;
    for (const h of Object.values(d.hosts)) {
      for (const k of Object.keys(h)) if (hostNew.test(k)) delete h[k];
      for (const p of h.planets) for (const k of Object.keys(p)) if (planetNew.test(k)) delete p[k];
    }
  });
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  const section = await openAdvanced(page);
  for (const f of ADV_FIELDS) await expect(advValue(section, f)).toContainText('n/a');
  expect(errors).toEqual([]);
});

test('1280x720: advanced card stays clear of the music player, column scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await serveFixtureData(page);
  await serveStarCardHost(page);
  await openAppReady(page);
  await selectHost(page, 'proxima cen', HOST);
  await expect(page.getByTestId('music-collapse')).toBeVisible(); // expanded by default = tallest
  const section = await openAdvanced(page);

  const panel = page.getByTestId('selection-card');
  const player = page.locator('[data-hud=music-player]');
  await expect(player).toBeVisible();
  const p = (await panel.boundingBox())!;
  const m = (await player.boundingBox())!;
  const overlap =
    p.x < m.x + m.width && m.x < p.x + p.width && p.y < m.y + m.height && m.y < p.y + p.height;
  expect(overlap).toBe(false);

  // The last row must be reachable by scrolling and end up inside the card box.
  const last = advValue(section, 'st_vsin');
  await last.scrollIntoViewIfNeeded();
  const l = (await last.boundingBox())!;
  const p2 = (await panel.boundingBox())!;
  expect(l.y).toBeGreaterThanOrEqual(p2.y);
  expect(l.y + l.height).toBeLessThanOrEqual(p2.y + p2.height);
});
