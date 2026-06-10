// M7 spot check against the preview server with the REAL data artifacts:
// enter the TRAPPIST-1 System View, toggle the HZ, screenshot for the
// CHECKPOINT 4 human review. Usage: node scripts/check-m7.mjs [url]
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

const input = page.getByTestId('search-input');
await input.click();
await input.fill('trappist');
await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
await page.getByTestId('view-system-button').click();
await page.waitForSelector('[data-testid="system-title"]');
await page.getByTestId('toggle-hz').check();
await page.getByTestId('planet-chip').nth(3).click(); // TRAPPIST-1 e
await page.waitForTimeout(2500);

const sys = await page.evaluate(() => globalThis.__system);
console.log('[info] planets:', sys.planets.map((p) => p.name).join(', '));
console.log('[info] tDays:', sys.tDays.toFixed(2), '| timeScale:', sys.timeScale);
console.log('[info] hz:', JSON.stringify(sys.hz));
await page.screenshot({ path: 'm7-real-data.png' });
console.log('[info] screenshot: m7-real-data.png');
console.log(sys.planets.length === 7 && sys.hz ? '[PASS]' : '[FAIL]');
await browser.close();
