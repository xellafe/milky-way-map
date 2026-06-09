import { expect, test } from '@playwright/test';
import { serveFixtureData } from './fixtures';

// M2 acceptance: the star cloud renders correctly on the golden fixture.
// ?pdb=1 enables preserveDrawingBuffer so we can read real pixels back.
test('renders the star cloud from the fixture data', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await serveFixtureData(page);

  await page.goto('/?pdb=1');
  await expect(page.locator('canvas')).toBeVisible();
  // Loading overlay appears, then disappears once the core sections are in.
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });

  // Read back real pixels from the WebGL2 canvas: a star field must produce
  // a meaningful number of non-black pixels (fixture has the 1000 brightest).
  const litPixels = await page.evaluate(() => {
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
  expect(litPixels).toBeGreaterThan(100);

  expect(pageErrors).toEqual([]);
});

test('shows the error message when the data is unreachable', async ({ page }) => {
  await page.route('**/data/**', (route) => route.fulfill({ status: 500, body: 'boom' }));
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toContainText(/catalog|catalogo/i, {
    timeout: 10_000,
  });
});
