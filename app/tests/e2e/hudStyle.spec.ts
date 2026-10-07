/**
 * HUD visual language (#23): every card is square-cornered, blurred and has
 * corner brackets; the legacy .hud-panel class is gone.
 */
import { expect, test } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

test('HUD cards share the refined style', async ({ page }) => {
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
    const visible = (el: Element) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const radius = (el: Element) => getComputedStyle(el).borderTopLeftRadius;
    const cards = [...document.querySelectorAll('[data-hud-card]')].filter(visible);
    const tiles = [...document.querySelectorAll('[data-testid^="stat-"]')].filter(visible);
    const button = document.querySelector('[data-testid="language-button"]');
    const closes = [
      ...document.querySelectorAll('[data-testid="panel-close"], [data-testid="overlay-close"]'),
    ].filter(visible);
    return {
      cards: cards.map((c) => ({
        blur: getComputedStyle(c).backdropFilter,
        radius: radius(c),
        layers: (getComputedStyle(c).backgroundImage.match(/linear-gradient\(/g) ?? []).length,
      })),
      tiles: tiles.map(radius),
      button: button ? radius(button) : null,
      closeLabels: closes.map((c) => c.getAttribute('aria-label') ?? ''),
      legacy: document.querySelectorAll('.hud-panel').length,
    };
  });

  expect(r.cards.length).toBeGreaterThan(0);
  expect(r.cards.filter((c) => !c.blur.includes('blur'))).toEqual([]);
  expect(r.cards.filter((c) => c.radius !== '0px')).toEqual([]);
  expect(r.cards.filter((c) => c.layers < 4)).toEqual([]);
  expect(r.tiles.length).toBeGreaterThan(0);
  expect(r.tiles.filter((v) => v !== '0px')).toEqual([]);
  expect(r.button).toBe('0px');
  expect(r.legacy).toBe(0);
  expect(r.closeLabels.length).toBeGreaterThan(0);
  expect(r.closeLabels.filter((l) => l.trim() === '')).toEqual([]);
});

test('corner brackets stay on the box when a card scrolls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('filters-toggle').click();
  const panel = page.getByTestId('filters-panel');
  await expect(panel).toBeVisible();

  const attachment = await panel.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return getComputedStyle(el).backgroundAttachment;
  });
  expect(attachment).not.toContain('local');
});
