import { easeInOutCubic } from '../scene/cameraTween';

export type Vec3 = readonly [number, number, number];

/** Target snaps onto the planet; the camera moves by the same delta so the orbit offset is kept. */
export function followStep(camera: Vec3, target: Vec3, next: Vec3): { camera: Vec3; target: Vec3 } {
  return {
    camera: [
      camera[0] + next[0] - target[0],
      camera[1] + next[1] - target[1],
      camera[2] + next[2] - target[2],
    ],
    target: next,
  };
}

/** Eased target between `start` and the planet's current position; `t` in [0, 1]. */
export function approachTarget(start: Vec3, next: Vec3, t: number): Vec3 {
  const k = easeInOutCubic(t);
  return [
    start[0] + (next[0] - start[0]) * k,
    start[1] + (next[1] - start[1]) * k,
    start[2] + (next[2] - start[2]) * k,
  ];
}

/**
 * Horizontal projection shift, px, that moves the followed planet left of the
 * screen centre when the widest card would not fit between the planet and the
 * usable area's right edge; 0 when it already fits. The card sits `gap` px to
 * the right of the planet (selectionGeometry).
 */
export function followViewShift(
  area: { left: number; right: number },
  width: number,
  cardWidth: number,
  gap: number,
): number {
  if (width / 2 + gap + cardWidth <= area.right) return 0;
  return width / 2 - (area.right - cardWidth - gap);
}
