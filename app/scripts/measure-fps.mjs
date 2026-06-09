// FPS measurement against the preview server with the REAL data artifacts
// (SPEC §7 budget check; recorded in STATE.md at each milestone).
// Usage: node scripts/measure-fps.mjs [url] — default http://localhost:4173
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/?stats=1';

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-webgpu'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Wait until the loading overlay disappears (core data ready).
await page.waitForSelector('[data-testid="loading-overlay"]', {
  state: 'detached',
  timeout: 120_000,
});
console.log('[info] star cloud ready, measuring…');

const gpuInfo = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('[info] renderer:', gpuInfo);

for (let run = 0; run < 3; run++) {
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start >= 3000) {
            resolve((frames / (performance.now() - start)) * 1000);
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(`[fps ] run ${run + 1}: ${fps.toFixed(1)}`);
}

await page.screenshot({ path: 'fps-snapshot.png' });
await browser.close();
