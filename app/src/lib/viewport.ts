/** Below Tailwind's `lg` breakpoint, where the dock and the music player compete for space. */
export const COMPACT_VIEWPORT_QUERY = '(max-width: 1023px)';

export function isCompactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
}
