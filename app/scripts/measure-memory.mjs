// OOM repro: load the app with REAL data and sample JS heap via CDP.
// Usage: node scripts/_mem-monitor.mjs <url> [seconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/';
const seconds = Number(process.argv[3] ?? 60);

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu', '--use-angle=d3d11', '--enable-precise-memory-info'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
page.on('crash', () => console.log('[CRASH] page crashed (renderer OOM?)'));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200));
});

const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');

const heap = async () => {
  try {
    const { metrics } = await cdp.send('Performance.getMetrics');
    const get = (n) => metrics.find((m) => m.name === n)?.value ?? 0;
    return {
      heapMB: (get('JSHeapUsedSize') / 1048576).toFixed(0),
      totalMB: (get('JSHeapTotalSize') / 1048576).toFixed(0),
      nodes: get('Nodes'),
      listeners: get('JSEventListeners'),
      docs: get('Documents'),
    };
  } catch {
    return null;
  }
};

console.log('[goto]', url);
await page.goto(url, { waitUntil: 'domcontentloaded' });

const t0 = Date.now();
const timer = setInterval(async () => {
  const m = await heap();
  const t = ((Date.now() - t0) / 1000).toFixed(0);
  if (m) {
    console.log(
      `[t+${t}s] heap=${m.heapMB}MB total=${m.totalMB}MB nodes=${m.nodes} listeners=${m.listeners}`,
    );
  } else {
    console.log(`[t+${t}s] metrics unavailable (crashed?)`);
  }
}, 2000);

try {
  await page.waitForSelector('[data-testid="loading-overlay"]', {
    state: 'detached',
    timeout: 120_000,
  });
  console.log('[info] load complete, observing…');
} catch (e) {
  console.log('[warn] overlay never detached:', e.message.split('\n')[0]);
}

await page.waitForTimeout(seconds * 1000);
clearInterval(timer);
const final = await heap();
console.log('[final]', JSON.stringify(final));
await browser.close();
