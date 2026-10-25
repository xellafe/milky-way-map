/**
 * Issue #44: HudButton `size` is a prop, so the dock reset button always renders at
 * the small size instead of depending on the generated CSS order.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

const metrics = (el: Locator) =>
  el.evaluate((node) => {
    const s = getComputedStyle(node);
    return {
      fontSize: s.fontSize,
      paddingLeft: s.paddingLeft,
      paddingRight: s.paddingRight,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
    };
  });

const SMALL = {
  fontSize: '12px',
  paddingLeft: '8px',
  paddingRight: '8px',
  paddingTop: '4px',
  paddingBottom: '4px',
};

async function height(el: Locator) {
  const box = await el.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box.height;
}

test('filters-reset renders at the small size and is shorter than a default button', async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId('filters-toggle').click();
  const reset = page.getByTestId('filters-reset');
  await expect(reset).toBeVisible();
  expect(await metrics(reset)).toEqual(SMALL);
  expect(await height(reset)).toBeLessThan(await height(page.getByTestId('help-button')));
});

test('options-reset renders at the small size', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  const reset = page.getByTestId('options-reset');
  await expect(reset).toBeVisible();
  expect(await metrics(reset)).toEqual(SMALL);
});

test('default-size HudButton is unchanged', async ({ page }) => {
  await openApp(page);
  expect(await metrics(page.getByTestId('help-button'))).toEqual({
    fontSize: '14px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
  });
});
