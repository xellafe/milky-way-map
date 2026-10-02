/**
 * Sequenced opening of the selection overlay: ring (hud-lock) -> callout
 * (hud-draw) -> card (hud-unfold). Durations/delays are a human design choice.
 * Assertions read computed animation properties, which persist after the
 * animation ends, so they do not depend on frame timing.
 */
import { expect, test, type Page } from '@playwright/test';
import { serveFixtureData, waitForFlyToArrival } from './fixtures';

async function open(page: Page) {
  await serveFixtureData(page);
  await page.goto('/?pdb=1');
  await expect(page.getByTestId('loading-overlay')).toHaveCount(0, { timeout: 15_000 });
}

async function selectPolaris(page: Page) {
  await page.getByTestId('search-input').fill('polaris');
  await page.getByRole('option').filter({ hasText: 'Polaris' }).first().click();
  await waitForFlyToArrival(page);
}

const anim = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ['selection-ring', 'callout', 'selection-card'].map((h) => {
        const cs = getComputedStyle(document.querySelector(`[data-hud=${h}]`)!);
        return [
          h,
          {
            name: cs.animationName,
            duration: parseFloat(cs.animationDuration) * 1000,
            delay: parseFloat(cs.animationDelay) * 1000,
            fill: cs.animationFillMode,
          },
        ];
      }),
    ),
  );

test('ring, callout and card open in sequence with increasing delays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await selectPolaris(page);
  const a = await anim(page);
  expect(a['selection-ring']).toMatchObject({ name: 'hud-lock', duration: 600, delay: 0 });
  expect(a['callout']).toMatchObject({
    name: 'hud-draw',
    duration: 300,
    delay: 450,
    fill: 'backwards',
  });
  expect(a['selection-card']).toMatchObject({
    name: 'hud-unfold',
    duration: 250,
    delay: 700,
    fill: 'backwards',
  });
  expect(a['selection-ring']!.delay).toBeLessThan(a['callout']!.delay);
  expect(a['callout']!.delay).toBeLessThan(a['selection-card']!.delay);
});

test('after the opening the card is fully visible and the callout fully drawn', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await selectPolaris(page);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const card = getComputedStyle(document.querySelector('[data-hud=selection-card]')!);
          const path = getComputedStyle(document.querySelector('[data-hud=callout]')!);
          return {
            opacity: card.opacity,
            clipOk: card.clipPath === 'none' || card.clipPath === 'inset(0px)',
            dash: parseFloat(path.strokeDashoffset),
          };
        }),
      { timeout: 10_000 },
    )
    .toEqual({ opacity: '1', clipOk: true, dash: 0 });
});

// The unfold start keyframe is clip-path: inset(0 var(--unfold-r) 0 var(--unfold-l)).
// Resolving the custom properties on the card is timing-independent, unlike
// getKeyframes() on an animation that may already have finished.
const unfoldVars = (page: Page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[data-hud=selection-card]')!);
    return {
      r: cs.getPropertyValue('--unfold-r').trim(),
      l: cs.getPropertyValue('--unfold-l').trim(),
    };
  });

test('the card unfolds away from the callout side on both sides', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await selectPolaris(page);
  const side = page.locator('[data-hud=selection-overlay]');
  await expect(side).toHaveAttribute('data-side', 'right');
  // Right: card is right of the callout, hidden part is the right edge.
  expect(await unfoldVars(page)).toEqual({ r: '100%', l: '0px' });

  // Same drag as selectionRing.spec.ts pushes the star right, flipping the side.
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(100);
  await page.keyboard.up('KeyS');
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(440, 360, { steps: 1 });
  await page.mouse.up();
  await expect(side).toHaveAttribute('data-side', 'left');
  expect(await unfoldVars(page)).toEqual({ r: '0px', l: '100%' });
});

test('reduced motion: no opening animations and the card is visible at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await selectPolaris(page);
  await expect(page.getByTestId('selection-card')).toBeVisible();
  const state = await page.evaluate(() => {
    const names = ['selection-ring', 'callout', 'selection-card'].flatMap((h) =>
      document
        .querySelector(`[data-hud=${h}]`)!
        .getAnimations({ subtree: true })
        .map((a) => (a as CSSAnimation).animationName),
    );
    const card = getComputedStyle(document.querySelector('[data-hud=selection-card]')!);
    return { names, opacity: card.opacity };
  });
  expect(state.names).toEqual([]);
  expect(state.opacity).toBe('1');
});
