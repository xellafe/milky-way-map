import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

/**
 * Since M5 a search-select fly-to is ANIMATED (up to FLY_MAX_DURATION_S =
 * 2.5 s): tests that interact with the screen-centered target must wait for
 * the flight to land first.
 */
export async function waitForFlyToArrival(page: Page): Promise<void> {
  await page.waitForTimeout(2800);
}

/**
 * Serve /data/* from the committed golden fixtures (deterministic, no real
 * artifacts needed in CI), honoring Range requests like a CDN would.
 */
export async function serveFixtureData(page: Page): Promise<void> {
  await page.route('**/data/**', async (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').pop() ?? '';
    let body: Buffer;
    try {
      body = readFileSync(path.join(FIXTURES, name));
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
      return;
    }
    const contentType = name.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const range = route.request().headers()['range'];
    const m = range ? /bytes=(\d+)-(\d+)/.exec(range) : null;
    if (m) {
      const start = Number(m[1]);
      const end = Math.min(Number(m[2]), body.byteLength - 1);
      await route.fulfill({
        status: 206,
        contentType,
        headers: { 'Content-Range': `bytes ${start}-${end}/${body.byteLength}` },
        body: body.subarray(start, end + 1),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType, body });
  });
}
