import type { Area } from '../lib/overlayPlacement';

// Clearance between a card and the HUD around it, px. Aesthetic choice (not data).
const MARGIN_PX = 8;

const rectOf = (hud: string) =>
  document.querySelector(`[data-hud=${hud}]`)?.getBoundingClientRect();

/**
 * Viewport band free for floating cards (#23): below the search box (or the
 * System View header), above the dock bar, the time bar and the music player (the open dock panel is narrower and floats over the card, SPEC §3), between
 * the side panels when present. Measured, not hard-coded: the HUD reflows.
 */
export function readUsableArea(width: number, height: number): Area {
  const top = rectOf('search')?.bottom ?? rectOf('system-header')?.bottom ?? 0;
  const bottom = Math.min(
    height,
    ...['dock', 'time-bar', 'music-player'].map((hud) => rectOf(hud)?.top ?? height),
  );
  // Phone sheet (#25): it spans the full width in portrait (takes the bottom edge) and
  // is narrower than the viewport in landscape (takes the right edge).
  const sheet = rectOf('mobile-sheet');
  const sheetBelow = sheet && sheet.width >= width - 1 ? sheet.top : height;
  const sheetRight = sheet && sheet.width < width - 1 ? sheet.left : width;
  return {
    left: (rectOf('side-panel-left')?.right ?? 0) + MARGIN_PX,
    top: top + MARGIN_PX,
    right: Math.min(rectOf('side-panel-right')?.left ?? width, sheetRight) - MARGIN_PX,
    bottom: Math.min(bottom, sheetBelow) - MARGIN_PX,
  };
}
