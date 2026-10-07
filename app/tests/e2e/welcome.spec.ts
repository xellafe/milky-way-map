/**
 * Issue #12: welcome dialog shown on first load, reopenable from the "?"
 * button, with a persisted "don't show again" choice.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

// Start from a clean profile: the global config pre-dismisses the dialog.
test.use({ storageState: { cookies: [], origins: [] } });

async function openApp(page: Page) {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function reload(page: Page) {
  await page.reload();
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

const dialog = (page: Page) => page.getByTestId('welcome-dialog');

test('shows the dialog on first load', async ({ page }) => {
  await openApp(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText('Welcome to Galaxy Map');
  await expect(dialog(page)).toContainText('Quick guide');
});

test('Start exploring closes it', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-start').click();
  await expect(dialog(page)).toBeHidden();
});

test('Escape closes it', async ({ page }) => {
  await openApp(page);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test("don't show again persists across reloads", async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-dont-show').check();
  await page.getByTestId('welcome-start').click();
  await reload(page);
  await expect(dialog(page)).toBeHidden();
});

test('Escape also saves the choice', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-dont-show').check();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await reload(page);
  await expect(dialog(page)).toBeHidden();
});

test('without the checkbox it shows again', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-start').click();
  await reload(page);
  await expect(dialog(page)).toBeVisible();
});

test('help button reopens it with the saved choice', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-dont-show').check();
  await page.getByTestId('welcome-start').click();
  await expect(dialog(page)).toBeHidden();

  await page.getByTestId('help-button').click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId('welcome-dont-show')).toBeChecked();

  await page.getByTestId('welcome-dont-show').uncheck();
  await page.getByTestId('welcome-start').click();
  await expect(dialog(page)).toBeHidden();
  await reload(page);
  await expect(dialog(page)).toBeVisible();
});

test('focus returns to the help button', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-start').click();
  await page.getByTestId('help-button').click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId('help-button')).toBeFocused();
});

test('help button works in the System View', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-start').click();

  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('trappist');
  await page.getByRole('option').filter({ hasText: 'TRAPPIST-1' }).first().click();
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');

  await page.getByTestId('help-button').click();
  await expect(dialog(page)).toBeVisible();
});

for (const height of [720, 600]) {
  test(`fits the viewport at 1280x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    await openApp(page);
    await expect(dialog(page)).toBeVisible();
    const box = await dialog(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  });
}

test.describe('Italian locale', () => {
  test.use({ locale: 'it-IT' });

  test('opens translated', async ({ page }) => {
    await openApp(page);
    await expect(dialog(page)).toContainText('Benvenuto in Galaxy Map');
  });
});

test('welcome dialog has no blocking axe violations', async ({ page }) => {
  await openApp(page);
  await expect(dialog(page)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('[data-testid="welcome-dialog"]')
    .analyze();
  const violations = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test('movement keys do not move the camera while the dialog is open', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await expect(dialog(page)).toBeVisible();
  // The dialog opens with welcome-start focused (focused after showModal), so the input guard
  // is not what ignores the keys: the dialog guard is under test. Focus is set
  // explicitly to keep the test independent of the initial focus.
  await page.getByTestId('welcome-start').focus();

  const position = () =>
    page.evaluate(
      () => ((globalThis as Record<string, unknown>).__camera as { position: number[] }).position,
    );
  const hold = async () => {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(100);
  };

  const before = await position();
  await hold();
  expect(await position()).toEqual(before);

  // Control: with the dialog closed the same key moves the camera.
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await hold();
  expect(await position()).not.toEqual(before);
});

test('Escape in the dialog does not close an open dock panel', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-start').click();
  await expect(dialog(page)).toBeHidden();

  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();

  await page.getByTestId('help-button').click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
});

test('movement keys are ignored after clicking the dialog text', async ({ page }) => {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  await expect(dialog(page)).toBeVisible();
  await page.locator('#welcome-title').click();

  const position = () =>
    page.evaluate(
      () => ((globalThis as Record<string, unknown>).__camera as { position: number[] }).position,
    );
  const before = await position();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(100);
  expect(await position()).toEqual(before);
});

test('Escape after clicking the dialog text keeps the dock panel open', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('welcome-start').click();
  await expect(dialog(page)).toBeHidden();

  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filters-panel')).toBeVisible();

  await page.getByTestId('help-button').click();
  await expect(dialog(page)).toBeVisible();
  await page.locator('#welcome-title').click();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId('filters-panel')).toBeVisible();
});

test('initial focus is on Start exploring', async ({ page }) => {
  await openApp(page);
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId('welcome-start')).toBeFocused();
});

test('shows the dialog while the catalog is still loading', async ({ page }) => {
  await serveFixtureData(page);
  // Registered after the fixture route, so it runs first and defers to it.
  await page.route('**/data/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fallback();
  });
  await page.goto('/');
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId('loading-overlay')).toBeVisible();
});
