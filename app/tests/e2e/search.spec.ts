/**
 * #37 / SPEC §6.4: catalog ids typed without separators, exact match first,
 * and the debounced search (one Gaia bucket request per typed id).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

async function openApp(page: Page): Promise<void> {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

test('HIP id without a space lists Polaris first', async ({ page }) => {
  await openApp(page);
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('HIP11767');
  await expect(page.getByRole('option').first()).toHaveText('Polaris');
});

test('typing a Gaia id key by key fetches a single bucket', async ({ page }) => {
  await openApp(page);
  const requests: string[] = [];
  // Registered after serveFixtureData: the last matching route wins.
  await page.route('**/data/search/gaia-*', async (route) => {
    requests.push(route.request().url());
    await route.fallback();
  });
  const input = page.getByTestId('search-input');
  await input.click();
  await input.pressSequentially('5853498713190525696');
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByTestId('search-results')).toContainText(/no results/i);
  expect(requests).toHaveLength(1);
});

test('Enter right after typing selects the typed star, not the previous results', async ({
  page,
}) => {
  await openApp(page);
  const input = page.getByTestId('search-input');
  await input.click();
  // Waiting for a first result guarantees the names index is loaded.
  await input.fill('sol');
  await expect(page.getByRole('option').filter({ hasText: 'Sol' }).first()).toBeVisible();
  await input.fill('polaris');
  await input.press('Enter');
  await expect(page.getByTestId('selection-card')).toBeVisible();
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

test('clicking the canvas closes the result list', async ({ page }) => {
  await openApp(page);
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('polaris');
  const list = page.getByTestId('search-results');
  await expect(list).toBeVisible();
  // List box sits directly below the input (desktop layout).
  const inputBox = (await input.boundingBox())!;
  const listBox = (await list.boundingBox())!;
  expect(listBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height);
  expect(listBox.y - (inputBox.y + inputBox.height)).toBeLessThan(16);

  await page
    .locator('canvas')
    .first()
    .click({ position: { x: 600, y: 400 } });
  await expect(page.getByTestId('search-results')).toHaveCount(0);
  await expect(input).toHaveValue('polaris');

  await input.focus();
  await expect(page.getByTestId('search-results')).toBeVisible();
});

for (const [name, use] of [
  ['desktop', { viewport: { width: 1280, height: 720 } }],
  // Phone layout needs a coarse pointer, hence the touch device profile.
  ['phone', { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }],
] as const) {
  test.describe(`axe, ${name}`, () => {
    test.use(use);

    test(`open result list has no blocking axe violations (${name})`, async ({ page }) => {
      await openApp(page);
      if (name === 'phone') await page.getByTestId('search-open').click();
      const input = page.getByTestId('search-input');
      await input.click();
      await input.fill('polaris');
      await expect(page.getByRole('option').filter({ hasText: 'Polaris' }).first()).toBeVisible();
      const results = await new AxeBuilder({ page }).exclude('canvas').analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  });
}

test('ArrowDown before results load, then Enter selects the first result', async ({ page }) => {
  await openApp(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Registered after serveFixtureData: the last matching route wins.
  await page.route('**/data/names.index.json', async (route) => {
    await held;
    await route.fallback();
  });
  const input = page.getByTestId('search-input');
  await input.focus();
  await input.fill('polaris');
  await input.press('ArrowDown');
  release();
  await expect(page.getByRole('option').filter({ hasText: 'Polaris' }).first()).toBeVisible();
  await input.press('Enter');
  await expect(page.getByTestId('panel-title')).toHaveText('Polaris');
});

test('aria-activedescendant follows the active option', async ({ page }) => {
  await openApp(page);
  const input = page.getByTestId('search-input');
  await input.click();
  await expect(input).not.toHaveAttribute('aria-activedescendant', /.*/);
  await input.fill('sol');
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    expect(await options.nth(i).getAttribute('id')).toMatch(/^search-option-/);
  }
  const selectedId = async () =>
    page.locator('[role="option"][aria-selected="true"]').getAttribute('id');
  await expect(input).toHaveAttribute('aria-activedescendant', (await selectedId())!);
  if (count > 1) {
    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', (await selectedId())!);
    expect(await options.nth(1).getAttribute('id')).toBe(
      await input.getAttribute('aria-activedescendant'),
    );
    await input.press('ArrowUp');
    expect(await options.first().getAttribute('id')).toBe(
      await input.getAttribute('aria-activedescendant'),
    );
  }
  await input.press('Escape');
  await expect(input).not.toHaveAttribute('aria-activedescendant', /.*/);
});

test('hover sets the active option', async ({ page }) => {
  await openApp(page);
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill('sol');
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();
  expect(await options.count()).toBeGreaterThan(1);
  await expect(page.getByTestId('search-results').locator('button')).toHaveCount(0);
  await options.nth(1).hover();
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
});

test.describe('phone viewport', () => {
  // Phone layout needs a coarse pointer, hence the touch device profile.
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('phone blur closes the list', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('search-open').click();
    const input = page.getByTestId('search-input');
    await input.fill('polaris');
    const option = page.getByRole('option').filter({ hasText: 'Polaris' }).first();
    await expect(option).toBeVisible();
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await input.blur();
    await expect(page.getByTestId('search-results')).toHaveCount(0);
    await expect(input).toBeVisible();

    await input.fill('');
    await input.blur();
    await expect(page.getByTestId('search-open')).toBeVisible();
  });
});
