/**
 * Issue #25 (spec §4.1, §4.3, §4.4): phone top bar, dock and music player.
 * The scene runs at a few fps in software rendering: wait on rAF frames.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

const frames = (page: Page, n = 2) =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

async function open(page: Page) {
  await serveFixtureData(page);
  // The player starts expanded by default; these tests start from the collapsed note button.
  await page.addInitScript(() => localStorage.setItem('galaxy-map-music-collapsed', '1'));
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await frames(page, 3);
}

/** Selects through the search box, opening the phone search field first when it is an icon. */
async function select(page: Page, query: string, name: string) {
  const opener = page.getByTestId('search-open');
  if (await opener.isVisible()) await opener.click();
  await page.getByTestId('search-input').fill(query);
  await page.getByRole('option').filter({ hasText: name }).first().click();
  await expect(page.getByTestId('mobile-sheet')).toHaveAttribute('data-snap', 'base');
  await waitForFlyToArrival(page);
  await frames(page);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

function expectInside(b: Box, vp: { width: number; height: number }, what: string) {
  expect(b.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
  expect(b.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
  expect(b.x + b.width, `${what} right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height, `${what} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

/** Visible buttons under the 44 px touch target (AC9), as "id: WxH" strings. */
const smallButtons = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#root button')]
      .map((el) => ({
        id: el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.outerHTML,
        r: el.getBoundingClientRect(),
      }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
      .map(({ id, r }) => `${id}: ${r.width}x${r.height}`),
  );

const SIZES = [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
  { width: 360, height: 640 },
] as const;

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('top bar, dock and music-expand are inside the viewport and do not overlap', async ({
      page,
    }) => {
      await open(page);
      const parts = {
        'top-bar': await box(page.getByTestId('top-bar')),
        dock: await box(page.getByTestId('dock')),
        'music-expand': await box(page.getByTestId('music-expand')),
      };
      for (const [k, b] of Object.entries(parts)) expectInside(b, size, k);
      expect(overlaps(parts['top-bar'], parts.dock), 'top-bar/dock').toBe(false);
      expect(overlaps(parts['top-bar'], parts['music-expand']), 'top-bar/music').toBe(false);
      expect(overlaps(parts.dock, parts['music-expand']), 'dock/music').toBe(false);
    });

    test('search-open reveals the input without covering help and language', async ({ page }) => {
      await open(page);
      await page.getByTestId('search-open').click();
      const input = page.getByTestId('search-input');
      await expect(input).toBeVisible();
      await expect(input).toBeFocused();
      await frames(page);
      const ib = await box(input);
      expectInside(ib, size, 'search-input');
      for (const id of ['help-button', 'language-button']) {
        expect(overlaps(ib, await box(page.getByTestId(id))), `input/${id}`).toBe(false);
      }
      await input.fill('polaris');
      await expect(page.getByTestId('search-results')).toBeVisible();
    });

    test('Esc on an empty search closes the input back to the icon', async ({ page }) => {
      await open(page);
      await page.getByTestId('search-open').click();
      await expect(page.getByTestId('search-input')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('search-input')).toBeHidden();
      await expect(page.getByTestId('search-open')).toBeVisible();
    });

    test('a dock button swaps the card for the dock panel and closing restores it', async ({
      page,
    }) => {
      await open(page);
      await select(page, 'polaris', 'Polaris');
      const sheet = page.getByTestId('mobile-sheet');
      await page.getByTestId('filters-toggle').click();
      await expect(sheet.getByTestId('dock-panel')).toBeVisible();
      await expect(page.getByTestId('selection-card')).toHaveCount(0);
      const panel = await box(page.getByTestId('dock-panel'));
      const toggle = await box(page.getByTestId('filters-toggle'));
      expect(toggle.y + toggle.height / 2, 'dock buttons sit below the panel').toBeGreaterThan(
        panel.y + panel.height / 2,
      );
      await page.getByTestId('filters-toggle').click();
      await expect(page.getByTestId('dock-panel')).toHaveCount(0);
      await expect(page.getByTestId('selection-card')).toBeVisible();
      await expect(sheet).toHaveAttribute('data-snap', 'base');
    });

    test('music-expand puts the controls in the sheet and keeps the audio mounted', async ({
      page,
    }) => {
      await open(page);
      await page.getByTestId('music-expand').click();
      const sheet = page.getByTestId('mobile-sheet');
      await expect(sheet.getByTestId('music-toggle')).toBeVisible();
      await expect(page.getByTestId('dock-panel')).toHaveCount(0);
      await expect(page.getByTestId('music-audio')).toHaveCount(1);
      await page.getByTestId('music-collapse').click();
      await expect(page.getByTestId('music-expand')).toBeVisible();
      await expect(page.getByTestId('music-audio')).toHaveCount(1);
      await page.getByTestId('music-expand').click();
      await expect(sheet.getByTestId('music-toggle')).toBeVisible();
      await expect(page.getByTestId('music-audio')).toHaveCount(1);
    });

    test('AC9: every visible button is at least 44x44', async ({ page }) => {
      await open(page);
      expect(await smallButtons(page), 'idle').toEqual([]);

      await page.getByTestId('search-open').click();
      expect(await smallButtons(page), 'search open').toEqual([]);
      await page.keyboard.press('Escape');

      await select(page, 'polaris', 'Polaris');
      expect(await smallButtons(page), 'card at base').toEqual([]);
      await page.getByTestId('filters-toggle').click();
      await expect(page.getByTestId('dock-panel')).toBeVisible();
      expect(await smallButtons(page), 'dock panel').toEqual([]);
    });

    test('AC9: buttons stay at least 44x44 with the music controls and the language menu open', async ({
      page,
    }) => {
      await open(page);
      await page.getByTestId('music-expand').click();
      await expect(page.getByTestId('mobile-sheet').getByTestId('music-toggle')).toBeVisible();
      expect(await smallButtons(page), 'music controls in the sheet').toEqual([]);
      await page.getByTestId('music-collapse').click();

      await page.getByTestId('language-button').click();
      await expect(page.getByTestId('language-menu')).toBeVisible();
      expect(await smallButtons(page), 'language menu').toEqual([]);
    });

    test('Esc on an empty search returns focus to search-open', async ({ page }) => {
      await open(page);
      await page.getByTestId('search-open').click();
      await expect(page.getByTestId('search-input')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('search-input')).toBeHidden();
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
        .toBe('search-open');
    });
  });
}

test.describe('short portrait viewport', () => {
  test.use({ viewport: { width: 375, height: 400 } });

  test('search results stay inside the viewport and the layout stays portrait', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'portrait');
    await page.getByTestId('search-open').click();
    await page.getByTestId('search-input').fill('polaris');
    const results = page.getByTestId('search-results');
    await expect(results).toBeVisible();
    await frames(page);
    expectInside(await box(results), { width: 375, height: 400 }, 'search-results');
    await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'portrait');
  });
});

test.describe('sheet handle from closed', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('a tap on the handle reopens the sheet at base', async ({ page }) => {
    await open(page);
    await select(page, 'polaris', 'Polaris');
    const sheet = page.getByTestId('mobile-sheet');
    const h = await box(page.getByTestId('sheet-handle'));
    const x = h.x + h.width / 2;
    await page.mouse.move(x, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, 700, { steps: 5 });
    await page.mouse.move(x, 811, { steps: 5 });
    await page.mouse.up();
    await expect(sheet).toHaveAttribute('data-snap', 'closed');
    await page.getByTestId('sheet-handle').click();
    await expect(sheet).toHaveAttribute('data-snap', 'base');
  });
});
