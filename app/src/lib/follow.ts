import { easeInOutCubic } from '../scene/cameraTween';
import { RING_HALF_PX } from './selectionGeometry';

export type Vec3 = readonly [number, number, number];

export type MutVec3 = [number, number, number];

/**
 * Target snaps onto the planet (the new target is `next`); the camera moves by the same delta so
 * the orbit offset is kept. Writes the new camera position into `out` and returns it. Per-frame
 * path: `out` may alias `camera`, never `target`/`next`.
 */
export function followStep(camera: Vec3, target: Vec3, next: Vec3, out: MutVec3): MutVec3 {
  out[0] = camera[0] + next[0] - target[0];
  out[1] = camera[1] + next[1] - target[1];
  out[2] = camera[2] + next[2] - target[2];
  return out;
}

/**
 * Eased target between `start` and the planet's current position; `t` in [0, 1]. Writes into
 * `out` and returns it (per-frame path); `out` may alias `start`, never `next`.
 */
export function approachTarget(start: Vec3, next: Vec3, t: number, out: MutVec3): MutVec3 {
  const k = easeInOutCubic(t);
  out[0] = start[0] + (next[0] - start[0]) * k;
  out[1] = start[1] + (next[1] - start[1]) * k;
  out[2] = start[2] + (next[2] - start[2]) * k;
  return out;
}

/**
 * Horizontal projection shift, px, that moves the followed planet left of the
 * screen centre when the widest card would not fit between the planet and the
 * usable area's right edge; 0 when it already fits. The card sits `gap` px to
 * the right of the planet (selectionGeometry). Never moves the planet's ring
 * left of the usable area (#23): when the card then does not fit, `placeCard`
 * picks a side and overlapping the right panel is the accepted degradation.
 */
export function followViewShift(
  area: { left: number; right: number },
  width: number,
  cardWidth: number,
  gap: number,
): number {
  if (width / 2 + gap + cardWidth <= area.right) return 0;
  const shift = width / 2 - (area.right - cardWidth - gap);
  return Math.max(0, Math.min(shift, width / 2 - (area.left + RING_HALF_PX)));
}
