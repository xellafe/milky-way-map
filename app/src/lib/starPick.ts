/** Mouse hit-target diameter for hover/click picking, in CSS px (aesthetic choice, not data). */
export const PICK_MIN_PX = 7;
/** Touch hit-target diameter, in CSS px: a fingertip is far less precise than a mouse (aesthetic choice, not data). */
export const PICK_MIN_PX_TOUCH = 22;
/** Minimum time between camera-driven hover re-picks, in ms (perf/aesthetic choice, not data; #45). */
export const HOVER_REPICK_INTERVAL_MS = 100;

/**
 * Minimum pick diameter in framebuffer px: gl_PointSize is a framebuffer-pixel
 * diameter, so the CSS size is scaled by the pixel ratio to keep the same on-screen size (#45).
 */
export function pickMinPx(coarse: boolean, dpr: number): number {
  return (coarse ? PICK_MIN_PX_TOUCH : PICK_MIN_PX) * dpr;
}

export interface HoverPickState {
  moved: boolean;
  inside: boolean;
  touch: boolean;
  dragging: boolean;
  poseChanged: boolean;
  inFlight: boolean;
  nowMs: number;
  lastPickMs: number;
}

/** Decides whether this frame issues a hover pick (pointer move, or camera-driven re-pick throttled to ~10 Hz). */
export function shouldPickHover(s: HoverPickState): boolean {
  if (s.inFlight || !s.inside || s.dragging) return false;
  if (s.moved) return true;
  return s.poseChanged && !s.touch && s.nowMs - s.lastPickMs >= HOVER_REPICK_INTERVAL_MS;
}

/** Monotonic ticket so an async result that was superseded or invalidated is never applied. */
export function createLatestOnly(): {
  next(): number;
  invalidate(): void;
  isCurrent(id: number): boolean;
} {
  let counter = 0;
  let latest = -1;
  return {
    next() {
      latest = ++counter;
      return latest;
    },
    invalidate() {
      latest = ++counter;
    },
    isCurrent(id: number) {
      return id === latest;
    },
  };
}
