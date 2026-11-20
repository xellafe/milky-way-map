/**
 * #47: units and punctuation come from the locale files. French joins value and
 * unit, and a colon, with a no-break space; English reads as before. Also: no
 * duplicate DOM id across the dock panels, and the welcome "move" row keeps its keys.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData } from './fixtures';

const NBSP = ' ';

async function openApp(page: Page, lang?: 'fr') {
  await serveFixtureData(page);
  await page.goto('/');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
  if (lang) {
    await page.getByTestId('language-button').click();
    await page.getByTestId(`language-option-${lang}`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
}

async function searchAndPick(page: Page, query: string, label: string) {
  const input = page.getByTestId('search-input');
  await input.click();
  await input.fill(query);
  await page.getByRole('option').filter({ hasText: label }).first().click();
}

async function expectUniqueIds(page: Page) {
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((el) => el.id));
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
}

test('fr: option values, star tiles, planet card and language label use no-break spaces', async ({
  page,
}) => {
  await openApp(page, 'fr');
  await expect(page.getByTestId('language-button')).toHaveAttribute(
    'aria-label',
    new RegExp(`^Choisir la langue${NBSP}: `),
  );

  await page.getByTestId('options-toggle').click();
  const speed = page.getByTestId('option-moveSpeedLyPerS').locator('xpath=ancestor::label[1]');
  await expect(speed).toContainText(`${NBSP}a.l./s`);
  await page.getByTestId('options-toggle').click();

  await searchAndPick(page, 'polaris', 'Polaris');
  await expect(page.getByTestId('stat-distance')).toContainText(`${NBSP}a.l.`);
  await expect(page.getByTestId('stat-teff')).toContainText(`≈${NBSP}`);
  await expect(page.getByTestId('stat-teff')).toContainText(`${NBSP}K`);

  await searchAndPick(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.getByTestId('planet-chip').first().click();
  await expect(page.getByTestId('planet-panel')).toContainText(`Type${NBSP}: `);
});

test('en: the same elements read as before', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('language-button')).toHaveAttribute(
    'aria-label',
    /^Select language: /,
  );

  await page.getByTestId('options-toggle').click();
  await expect(
    page.getByTestId('option-moveSpeedLyPerS').locator('xpath=ancestor::label[1]'),
  ).toContainText('25 ly/s');
  await expect(
    page.getByTestId('option-autoOrbitSpeedDegPerS').locator('xpath=ancestor::label[1]'),
  ).toContainText('°/s');
  await expect(
    page.getByTestId('option-twinkleSpeed').locator('xpath=ancestor::label[1]'),
  ).toContainText('×');
  await page.getByTestId('options-toggle').click();

  await page.getByTestId('filters-toggle').click();
  await expect(page.getByTestId('filter-distance')).toContainText('Distance (ly)');
  await page.getByTestId('filters-toggle').click();

  await expect(page.getByTestId('music-title')).not.toHaveText('');

  await searchAndPick(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.getByTestId('planet-chip').first().click();
  await expect(page.getByTestId('planet-panel')).toContainText('Type: ');
});

test('no duplicate DOM id with the options tab (Galaxy and System View) and the view tab open', async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('options-panel')).toBeVisible();
  await expectUniqueIds(page);
  await page.getByTestId('options-toggle').click();

  await searchAndPick(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.getByTestId('options-toggle').click();
  await expect(page.getByTestId('option-realism')).toBeVisible();
  await expectUniqueIds(page);
  await page.getByTestId('options-toggle').click();

  await page.getByTestId('view-toggle').click();
  await expect(page.getByTestId('system-view-panel')).toBeVisible();
  await expectUniqueIds(page);
});

test('System View realism switch updates the realism setting', async ({ page }) => {
  await openApp(page);
  await searchAndPick(page, 'trappist', 'TRAPPIST-1');
  await expect(page.getByTestId('system-title')).toHaveText('TRAPPIST-1');
  await page.getByTestId('options-toggle').click();
  await page.getByTestId('option-realism').check();
  await expect(page.getByTestId('option-starColorSaturation')).toBeDisabled();
});

test('welcome guide move row keeps its eight kbd keys on desktop', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('help-button').click();
  const row = page.getByTestId('welcome-dialog').locator('dd').nth(1);
  await expect(row.locator('kbd')).toHaveCount(8);
  await expect(row).toContainText('up / down');
  await expect(row).toContainText('roll');
});
