import type { DockPanelId, ViewMode } from '../state/store';
import type { Area } from './overlayPlacement';

export type SheetSnap = 'closed' | 'base' | 'expanded';
export type SheetContent = 'dock' | 'music' | 'star' | 'system' | 'planet';

/**
 * What the single phone sheet shows (#25, spec §4.1). One piece of content at a
 * time: an open dock panel or the expanded player takes it over from the card.
 */
export function sheetContent(s: {
  view: ViewMode;
  hasStar: boolean;
  hasPlanet: boolean;
  dockPanel: DockPanelId | null;
  musicExpanded: boolean;
}): SheetContent | null {
  if (s.dockPanel) return 'dock';
  if (s.musicExpanded) return 'music';
  if (s.view === 'galaxy') return s.hasStar ? 'star' : null;
  return s.hasPlanet ? 'planet' : 'system';
}

/** Offset (px) from the viewport centre to the centre of the free area; feeds `setViewOffset`. */
export function centerShift(area: Area, width: number, height: number) {
  return {
    x: (area.left + area.right) / 2 - width / 2,
    y: (area.top + area.bottom) / 2 - height / 2,
  };
}
