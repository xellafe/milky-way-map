/**
 * Live check of the user's reduced-motion preference (SPEC §6.3/§6.9):
 * camera transitions degrade to instant jumps and the ambient auto-orbit is
 * disabled when set. The MediaQueryList is created once (this gets called
 * every frame) but `matches` is live, so OS-level changes apply immediately.
 */
const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

export function prefersReducedMotion(): boolean {
  return query?.matches ?? false;
}

/**
 * Pixel-ratio ceiling for the Canvas on phones (#25, spec §5): the fill cost of the
 * full-screen bloom pass grows with the square of the ratio, and a 3x phone screen
 * pays 4x the pixels of 1.5x for a difference hardly visible on point sprites.
 * Unit: device pixels per CSS pixel. Human choice (not data).
 */
export const MOBILE_MAX_DPR = 1.5;

/**
 * Twinkle amplitude actually sent to the shader: none under reduced motion (SPEC §6.9),
 * in realism mode, or on phones (#25, spec §5: saves per-vertex work and battery).
 */
export function effectiveTwinkle(
  amplitude: number,
  o: { reducedMotion: boolean; realism: boolean; mobile: boolean },
): number {
  return o.reducedMotion || o.realism || o.mobile ? 0 : amplitude;
}
