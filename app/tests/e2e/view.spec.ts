/**
 * M6 acceptance (SPEC §6.2): the "always show names" and "constellation
 * lines" toggles work, and the DEFAULT configuration has zero clutter
 * (both off: no labels, no lines).
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

async function openApp(page: Page, query = '') {
  await serveFixtureData(page);
  await page.goto(`/${query}`);
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  // The toggles live in the View dock panel: open it once.
  await page.getByTestId('view-toggle').click();
  await expect(page.getByTestId('view-toggles')).toBeVisible();
}

test('default configuration: both toggles off, no labels in the way', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('toggle-names')).not.toBeChecked();
  await expect(page.getByTestId('toggle-constellations')).not.toBeChecked();
  await expect(page.getByTestId('star-label')).toHaveCount(0);
});

test('names toggle shows culled labels (1..MAX) and hides them again', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('toggle-names').click();

  // Labels appear once the names index + details land (background loads).
  await expect
    .poll(async () => page.getByTestId('star-label').count(), { timeout: 10_000 })
    .toBeGreaterThan(0);
  // Clutter cap: never more than MAX_LABELS (lib/labelCulling).
  expect(await page.getByTestId('star-label').count()).toBeLessThanOrEqual(20);

  await page.getByTestId('toggle-names').click();
  await expect.poll(async () => page.getByTestId('star-label').count(), { timeout: 5_000 }).toBe(0);
});

test('after flying to Polaris its label is shown (nearest = brightest from camera)', async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);

  await page.getByTestId('toggle-names').click();
  await expect(page.getByTestId('star-label').filter({ hasText: 'Polaris' }).first()).toBeVisible({
    timeout: 10_000,
  });
});

test('constellation lines toggle adds geometry to the frame and removes it', async ({ page }) => {
  await openApp(page, '?pdb=1');

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
  expect(before).toBeGreaterThan(100); // the star cloud itself

  // Lines are fetched lazily on first toggle-on, then rendered.
  await page.getByTestId('toggle-constellations').click();
  await expect.poll(litPixels, { timeout: 10_000 }).toBeGreaterThan(before * 1.2);

  await page.getByTestId('toggle-constellations').click();
  await expect.poll(litPixels, { timeout: 5_000 }).toBeLessThan(before * 1.2);
});
