import * as THREE from 'three';
import type { StarCoreData, StarDetailData } from '../data/starData';
import { computeFilterMask, type Filters } from '../lib/filterMask';

/** Shared SoA BufferGeometry: used by both StarCloud and the GPU-picking pass. */
export function buildStarGeometry(stars: StarCoreData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(stars.position, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(stars.colorRGB, 3, true));
  g.setAttribute('aSize', new THREE.BufferAttribute(stars.sizeAbsMag, 1));
  // Runtime filter mask (SPEC §6.5): updated in place, never reloaded.
  const visible = new Uint8Array(stars.count).fill(1);
  g.setAttribute('aVisible', new THREE.BufferAttribute(visible, 1));
  return g;
}

/**
 * Recompute the aVisible mask in place, flag the attribute for re-upload,
 * and return the number of visible stars.
 */
export function applyFilterMask(
  geometry: THREE.BufferGeometry,
  stars: StarCoreData,
  details: StarDetailData | null,
  filters: Filters,
): number {
  const attr = geometry.getAttribute('aVisible') as THREE.BufferAttribute;
  const mask = computeFilterMask(stars, details, filters, attr.array as Uint8Array);
  attr.needsUpdate = true;
  let count = 0;
  for (let i = 0; i < mask.length; i++) count += mask[i]!;
  return count;
}
