/**
 * #37 / SPEC §6.4: catalog ids typed without separators, exact match first,
 * and the debounced search (one Gaia bucket request per typed id).
 */
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
