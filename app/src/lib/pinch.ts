// Two-finger pinch maths for the galaxy camera (spec: mobile UI §3).

// Seconds of "W held" per CSS pixel of finger-distance change: 100 px of pinch
// = 1 s of forward flight. Aesthetic choice (not data), to be tuned by feel.
export const PINCH_SECONDS_PER_PX = 0.01;

interface Point {
  x: number;
  y: number;
}

export function pinchDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Orbit-distance factor: fingers spreading (cur > prev) gives < 1, i.e. closer. */
export function pinchDollyFactor(prevPx: number, curPx: number): number {
  return prevPx > 0 && curPx > 0 ? prevPx / curPx : 1;
}

/** Light years to advance along the view direction (negative = back off). */
export function pinchAdvanceLy(prevPx: number, curPx: number, moveSpeedLyPerS: number): number {
  return (curPx - prevPx) * PINCH_SECONDS_PER_PX * moveSpeedLyPerS;
}
