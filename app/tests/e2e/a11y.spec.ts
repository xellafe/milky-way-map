/**
 * M8 acceptance (SPEC §6.8/§6.9): language switching applies across the whole
 * UI and updates <html lang>; the 2D overlay is keyboard operable; axe finds
 * no blocking (serious/critical) violations. The 3D canvas is a documented
 * accessibility boundary (SPEC §6.9) and is excluded from the axe scan.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page, query = '') {
  await serveFixtureData(page);
  await page.goto(`/${query}`);
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function enterTrappist(page: Page) {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  const button = page.getByTestId('view-system-button');
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
}

const blocking = (impact: string | null | undefined) =>
  impact === 'serious' || impact === 'critical';

test('language selector switches the whole UI and updates <html lang>', async ({ page }) => {
  await openApp(page);

  // Default (Playwright Chromium → en): placeholder is the English one.
  await expect(page.getByTestId('search-input')).toHaveAttribute('placeholder', /Search a star/);
  await expect(page.getByTestId('language-button')).toContainText('EN');

  await page.getByTestId('language-button').click();
  await expect(page.getByTestId('language-menu')).toBeVisible();
  await page.getByTestId('language-option-it').click();

  // Menu closes, the whole UI re-renders in Italian, <html lang> follows.
  await expect(page.getByTestId('language-menu')).toHaveCount(0);
  await expect(page.getByTestId('search-input')).toHaveAttribute('placeholder', /Cerca una stella/);
  await expect(page.getByTestId('language-button')).toContainText('IT');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');

  // The choice is reflected in the menu (current = aria-checked).
  await page.getByTestId('language-button').click();
  await expect(page.getByTestId('language-option-it')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('language-option-en')).toHaveAttribute('aria-checked', 'false');
});

test('language menu is fully keyboard operable (arrows, Enter, Escape)', async ({ page }) => {
  await openApp(page);

  // Open with the keyboard; focus lands on the active item.
  await page.getByTestId('language-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('language-menu')).toBeVisible();
  await expect(page.getByTestId('language-option-en')).toBeFocused();

  // Arrow down to the next language and choose it.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('language-option-it')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('language-menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  // Focus returns to the trigger after selection.
  await expect(page.getByTestId('language-button')).toBeFocused();

  // Escape closes without changing language and returns focus to the button.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('language-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('language-menu')).toHaveCount(0);
  await expect(page.getByTestId('language-button')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

async function scan(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).exclude('canvas');
  const results = await (include ? builder.include(include) : builder).analyze();
  const violations = results.violations.filter((v) => blocking(v.impact));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test('galaxy overlay has no blocking axe violations', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('search-input').click();
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await expect(page.getByTestId('star-panel')).toBeVisible();
  await scan(page);
});

// One test per dock panel (each AxeBuilder.analyze opens a new page, so a single
// test scanning all panels exceeds the timeout under load).
const dockPanels = [
  ['filters', 'filters-toggle'],
  ['view', 'view-toggle'],
  ['options', 'options-toggle'],
] as const;

for (const [id, toggle] of dockPanels) {
  test(`dock panel ${id} has no blocking axe violations`, async ({ page }) => {
    await openApp(page);
    await page.getByTestId(toggle).click();
    await expect(page.getByTestId(toggle)).toHaveAttribute('aria-expanded', 'true');
    await scan(page, `#dock-panel-${id}`);
  });
}

test('music controls have no blocking axe violations', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('music-control')).toBeVisible();
  await scan(page, '[data-testid="music-control"]');
});

test('system overlay has no blocking axe violations', async ({ page }) => {
  await openApp(page);
  await enterTrappist(page);
  await page.getByTestId('planet-chip').first().click();

  const results = await new AxeBuilder({ page }).exclude('canvas').analyze();
  const violations = results.violations.filter((v) => blocking(v.impact));
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test('reduced motion: System View starts paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page, '?pdb=1');
  await enterTrappist(page);

  const readTimeScale = () =>
    page.evaluate(
      () => (globalThis as Record<string, unknown>).__system as { timeScale: number } | undefined,
    );
  await expect.poll(async () => (await readTimeScale()) !== undefined).toBe(true);
  expect((await readTimeScale())!.timeScale).toBe(0);
  // The pause control reflects the paused state (offers "resume").
  await expect(page.getByTestId('time-pause')).toContainText('▶');
});
