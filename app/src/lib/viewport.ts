import { useSyncExternalStore } from 'react';
import { layoutMode, type LayoutMode } from './layoutMode';

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

const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COARSE_POINTER_QUERY).matches
    : false;
}

function subscribeLayout(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', onChange);
  const mql =
    typeof window.matchMedia === 'function' ? window.matchMedia(COARSE_POINTER_QUERY) : null;
  mql?.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    mql?.removeEventListener('change', onChange);
  };
}

// A string snapshot is a stable primitive: useSyncExternalStore compares by identity.
export function currentLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  return layoutMode(window.innerWidth, window.innerHeight, isCoarsePointer());
}

/** Reactive phone layout mode (see `layoutMode`); follows resize/rotation. */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribeLayout, currentLayoutMode, () => 'desktop');
}
