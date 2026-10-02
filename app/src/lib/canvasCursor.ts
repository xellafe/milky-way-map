export type CanvasCursor = 'grab' | 'grabbing' | 'pointer';

/** Dragging wins over hover so the cursor does not flicker while panning over a star. */
export function canvasCursor(dragging: boolean, overTarget: boolean): CanvasCursor {
  if (dragging) return 'grabbing';
  return overTarget ? 'pointer' : 'grab';
}
