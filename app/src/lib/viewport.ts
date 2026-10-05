import { useSyncExternalStore } from 'react';

/** Below Tailwind's `lg` breakpoint, where the dock and the music player compete for space. */
export const COMPACT_VIEWPORT_QUERY = '(max-width: 1023px)';

export function isCompactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
}

// Module-level so the identity is stable: an inline subscribe would make React
// resubscribe on every render.
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(COMPACT_VIEWPORT_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getServerSnapshot = () => false;

/** Reactive `isCompactViewport()`: follows the media query across resizes. */
export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, isCompactViewport, getServerSnapshot);
}
