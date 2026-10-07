/**
 * M4 acceptance: every filter correctly changes the visible set (GPU mask,
 * no data reload) and search → fly-to works. Expected counts are computed
 * from the golden fixture, so each filter is verified EXACTLY.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

interface FixtureArrays {
  count: number;
  spectralClass: Uint8Array;
  flags: Uint8Array;
  distanceLy: Float32Array;
  appMag: Float32Array;
  absMag: Float32Array;
}

function readFixtureArrays(): FixtureArrays {
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { count: number; attributes: { name: string; byteOffset: number }[] };
  const bin = readFileSync(path.join(FIXTURES, 'stars.bin'));
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const attr = (name: string) => manifest.attributes.find((a) => a.name === name)!;
  return {
    count: manifest.count,
    spectralClass: new Uint8Array(buf, attr('spectralClass').byteOffset, manifest.count),
    flags: new Uint8Array(buf, attr('flags').byteOffset, manifest.count),
    distanceLy: new Float32Array(buf, attr('distanceLy').byteOffset, manifest.count),
    appMag: new Float32Array(buf, attr('appMag').byteOffset, manifest.count),
    absMag: new Float32Array(buf, attr('absMag').byteOffset, manifest.count),
  };
}

const fx = readFixtureArrays();
const countWhere = (pred: (i: number) => boolean) => {
  let n = 0;
  for (let i = 0; i < fx.count; i++) if (pred(i)) n++;
  return n;
};

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
}

function pollCount(page: Page) {
  return expect.poll(
    async () => {
      const text = await page.getByTestId('visible-count').textContent();
      return Number(text!.replace(/[^\d]/g, ''));
    },
    { timeout: 10_000 },
  );
}

test('spectral class filter shows exactly the selected classes', async ({ page }) => {
  // 8 sequential clicks, each recomputing the full GPU mask: under parallel
  // WebGL page contention this regularly needs more than the 60 s default.
  test.slow();
  await openApp(page);
  await pollCount(page).toBe(fx.count);

  // Hide every class except M (unknown off too).
  for (const letter of ['O', 'B', 'A', 'F', 'G', 'K']) {
    await page.getByTestId(`filter-class-${letter}`).click();
  }
  await page.getByTestId('filter-class-unknown').click();
  await expect(page.getByTestId('filter-class-M')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('filter-class-G')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('filter-class-M').click();
  await expect(page.getByTestId('filter-class-M')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('filter-class-M').click();

  await pollCount(page).toBe(countWhere((i) => fx.spectralClass[i] === 6));

  await page.getByTestId('filters-reset').click();
  await pollCount(page).toBe(fx.count);
});

test('only-exoplanets toggle leaves exactly the flagged stars', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('filter-exoplanets').click();
  await pollCount(page).toBe(countWhere((i) => (fx.flags[i]! & 4) !== 0)); // 1 in fixture

  await page.getByTestId('filter-exoplanets').click();
  await pollCount(page).toBe(fx.count);
});

test('distance range filter matches the exact in-range count', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('filter-distance-max').fill('50');
  await pollCount(page).toBe(countWhere((i) => fx.distanceLy[i]! >= 0 && fx.distanceLy[i]! <= 50));
});

test('range slider drives the distance bound and the visible count', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('filter-distance-max-slider').fill('50');
  await expect(page.getByTestId('filter-distance-max')).toHaveValue('50');
  await pollCount(page).toBe(countWhere((i) => fx.distanceLy[i]! >= 0 && fx.distanceLy[i]! <= 50));
  expect(await page.getByTestId('visible-count').textContent()).not.toContain(String(fx.count));
});

for (const id of ['appmag', 'distance']) {
  test(`${id} max slider at its far right keeps every star visible`, async ({ page }) => {
    await openApp(page);
    const total = await page.getByTestId('visible-count').textContent();
    const slider = page.getByTestId(`filter-${id}-max-slider`);
    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).toHaveValue((await slider.getAttribute('max'))!);
    await page.waitForTimeout(500);
    expect(await page.getByTestId('visible-count').textContent()).toBe(total);
  });
}

test('unknown-class chip has the translated accessible name', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('filter-class-unknown')).toHaveAccessibleName('unknown');
});

test('magnitude range filters match the exact in-range counts', async ({ page }) => {
  await openApp(page);
  const appMin = Math.floor(Math.min(...fx.appMag) * 10) / 10;

  await page.getByTestId('filter-appmag-max').fill('1');
  await pollCount(page).toBe(countWhere((i) => fx.appMag[i]! >= appMin && fx.appMag[i]! <= 1));

  await page.getByTestId('filters-reset').click();
  await pollCount(page).toBe(fx.count);

  const absMin = Math.floor(Math.min(...fx.absMag) * 10) / 10;
  await page.getByTestId('filter-absmag-max').fill('0');
  await pollCount(page).toBe(countWhere((i) => fx.absMag[i]! >= absMin && fx.absMag[i]! <= 0));
});

test('variable and multiple toggles match the catalog flag counts', async ({ page }) => {
  await openApp(page);

  await page.getByTestId('filter-variable').click();
  await pollCount(page).toBe(countWhere((i) => (fx.flags[i]! & 1) !== 0)); // Polaris included

  await page.getByTestId('filters-reset').click();
  await page.getByTestId('filter-multiple').click();
  await pollCount(page).toBe(countWhere((i) => (fx.flags[i]! & 2) !== 0)); // alf Cen A/B
});

test('filters visibly change the rendered cloud (GPU mask)', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

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

  await page.waitForTimeout(400);
  const before = await litPixels();
  expect(before).toBeGreaterThan(100);

  await page.getByTestId('filters-toggle').click();
  await page.getByTestId('filter-exoplanets').click();
  await pollCount(page).toBe(1);
  await page.waitForTimeout(400);
  expect(await litPixels()).toBeLessThan(before);
});

test('search by HD id finds the star and flies to it', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Polaris = HD 8890 (search by catalog id, SPEC §6.4).
  await page.getByTestId('search-input').fill('hd 8890');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');

  // Fly-to centered the star: hovering the canvas center names Polaris.
  await page.getByTestId('overlay-close').click();
  await waitForFlyToArrival(page);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-label')).toHaveText('Polaris', { timeout: 5_000 });
});

test('filtered-out stars are not pickable', async ({ page }) => {
  await openApp(page);

  // Center Polaris, hide class F (Polaris) → hover at center finds nothing.
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await page.getByTestId('overlay-close').click();
  await waitForFlyToArrival(page);

  await page.getByTestId('filter-class-F').click();
  await pollCount(page).toBe(countWhere((i) => fx.spectralClass[i] !== 3));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  await expect(page.getByTestId('hover-label')).toHaveCount(0);
});
