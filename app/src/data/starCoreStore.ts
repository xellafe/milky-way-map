import type * as THREE from 'three';
import type { StarCoreData } from './starData';

/**
 * Module-level holder for the star CORE data and the shared BufferGeometry.
 *
 * ⚠️ These multi-million-element typed arrays must NEVER flow through React
 * state, props, or the zustand store. React 19's dev-mode Performance Tracks
 * serialize component prop/state DIFFS element by element
 * (addObjectDiffToProperties): a 2.5M-star SoA in props turns every commit
 * into a minutes-long synchronous task allocating gigabytes — the dev-mode
 * browser OOM found after M4. React only ever sees `dataStatus` flips; the
 * actual buffers live here (same rule as starDetailsStore).
 */
let starCore: StarCoreData | null = null;
let starGeometry: THREE.BufferGeometry | null = null;
let geometryCore: StarCoreData | null = null;

export function setStarCore(core: StarCoreData): void {
  starCore = core;
}

export function getStarCore(): StarCoreData | null {
  return starCore;
}

/**
 * The shared geometry for `core`, built at most once per core. Idempotent on
 * purpose: React StrictMode runs the caller's useMemo twice in dev, and two
 * builds meant the filter mask landed on a geometry nobody rendered.
 */
export function ensureStarGeometry(
  core: StarCoreData,
  build: (core: StarCoreData) => THREE.BufferGeometry,
): THREE.BufferGeometry {
  if (!starGeometry || geometryCore !== core) {
    starGeometry = build(core);
    geometryCore = core;
  }
  return starGeometry;
}

export function getStarGeometry(): THREE.BufferGeometry | null {
  return starGeometry;
}
