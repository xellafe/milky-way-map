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
