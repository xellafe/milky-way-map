/**
 * Visual baselines (#48): System View (TRAPPIST-1, habitable zone on, three
 * orbit styles) and the galaxy view. Reduced motion pauses the System View and
 * turns the twinkle off, so frames are deterministic. Baselines are win32;
 * run `npm run build && npm run test:visual` before and after a render change.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from '../e2e/fixtures';

// The canvas fills the viewport and every HUD layer is a sibling stacked above it
// under the `[data-layout]` root (App.tsx). Hiding all root children that do not
// contain the canvas leaves only the scene; visibility (not display) keeps layout.
// Injected with addStyleTag: the `style` option of toHaveScreenshot did not hide
// the HUD in the captured PNGs.
const SCENE_ONLY_CSS =
  '[data-layout] > :not(:has(canvas)):not(canvas) { visibility: hidden !important; }';

async function expectScene(page: Page, name: string) {
  await page.addStyleTag({ content: SCENE_ONLY_CSS });
  await expect(page.locator('canvas').first()).toHaveScreenshot(name, {
    animations: 'disabled',
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
});

async function enterTrappist(page: Page, style: 'simple' | 'thick' | 'trail') {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.getByTestId('view-toggle').click();
  await page.getByTestId('orbit-style').selectOption(style);
  await page.getByTestId('toggle-hz').check();
  // Close the panel again so it does not cover the canvas.
  await page.getByTestId('view-toggle').click();
  await expect(page.getByTestId('toggle-hz')).toHaveCount(0);
}

for (const style of ['simple', 'thick', 'trail'] as const) {
  test(`system view, ${style} orbits, habitable zone`, async ({ page }) => {
    await enterTrappist(page, style);
    await expectScene(page, `system-${style}.png`);
  });
}

test('galaxy view', async ({ page }) => {
  await expectScene(page, 'galaxy.png');
});
