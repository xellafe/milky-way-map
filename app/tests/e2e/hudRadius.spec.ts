/**
 * Every HUD box (.hud-panel) and stat tile has a 3 px corner radius (human
 * design choice, not data); buttons keep their own radius.
 */
import { expect, test } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

// Radius of HudButton today (Tailwind `rounded` = 0.25rem at 16 px).
const BUTTON_RADIUS = '4px';

test('HUD boxes and stat tiles have a 3px radius, buttons are unchanged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();

  const r = await page.evaluate(() => {
    const radius = (el: Element) => getComputedStyle(el).borderTopLeftRadius;
    const visible = (el: Element) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const panels = [...document.querySelectorAll('.hud-panel')].filter(visible);
    const tiles = [...document.querySelectorAll('[data-testid^="stat-"]')].filter(visible);
    const button = document.querySelector('[data-testid="language-button"]');
    return {
      panels: panels.map(radius),
      tiles: tiles.map(radius),
      button: button ? radius(button) : null,
    };
  });

  expect(r.button).toBe(BUTTON_RADIUS);
  expect(r.panels.length).toBeGreaterThan(0);
  expect(r.tiles.length).toBeGreaterThan(0);
  expect(r.panels.filter((v) => v !== '3px')).toEqual([]);
  expect(r.tiles.filter((v) => v !== '3px')).toEqual([]);
});
