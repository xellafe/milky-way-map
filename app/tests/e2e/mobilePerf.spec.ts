/**
 * Issue #25 (spec §5): on phones the usable-area read (querySelector +
 * getBoundingClientRect, forced layout) must not run every frame.
 */
import { expect, test } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';
import { frames } from './mobileHelpers';

test.use({ viewport: { width: 375, height: 812 } });

test('a settled selection does not read layout every frame', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __rectReads: number };
    w.__rectReads = 0;
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      w.__rectReads++;
      return orig.call(this);
    };
  });
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-open').click();
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  await waitForFlyToArrival(page);
  await frames(page, 5);

  const reads = await page.evaluate(async () => {
    const w = window as unknown as { __rectReads: number };
    const before = w.__rectReads;
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return w.__rectReads - before;
  });
  expect(reads).toBeLessThanOrEqual(5);
});
