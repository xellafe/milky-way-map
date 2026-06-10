/**
 * Live check of the user's reduced-motion preference (SPEC §6.3/§6.9):
 * camera transitions degrade to instant jumps when set. Read at each
 * transition start (not cached) so OS-level changes apply immediately.
 */
export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
