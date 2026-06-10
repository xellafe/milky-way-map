// M6 spot check against the preview server with the REAL data artifacts:
// constellation lines toggle (lazy load + lit pixels) and always-on labels
// on the full 2.49M-star cloud. Usage: node scripts/check-m6.mjs [url]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/?pdb=1';

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu', '--use-angle=d3d11'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="loading-overlay"]', {
  state: 'detached',
  timeout: 120_000,
});

const litPixels = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) lit++;
    }
    return lit;
  });

await page.waitForTimeout(1000);
const before = await litPixels();
console.log('[info] lit pixels before:', before);

await page.getByTestId('toggle-constellations').click();
await page.waitForTimeout(3000); // lazy fetch + geometry build
const withLines = await litPixels();
console.log('[info] lit pixels with constellation lines:', withLines);

await page.getByTestId('toggle-names').click();
await page.waitForTimeout(2000);
const labels = await page.getByTestId('star-label').count();
const texts = await page.getByTestId('star-label').allTextContents();
console.log('[info] labels:', labels, texts.join(', '));

await page.screenshot({ path: 'm6-real-data.png' });
console.log('[info] screenshot: m6-real-data.png');
console.log(withLines > before * 1.2 && labels > 0 && labels <= 20 ? '[PASS]' : '[FAIL]');
await browser.close();
