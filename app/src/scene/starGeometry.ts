import * as THREE from 'three';
import type { StarCoreData } from '../data/starData';

/** Shared SoA BufferGeometry: used by both StarCloud and the GPU-picking pass. */
export function buildStarGeometry(stars: StarCoreData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(stars.position, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(stars.colorRGB, 3, true));
  g.setAttribute('aSize', new THREE.BufferAttribute(stars.sizeAbsMag, 1));
  return g;
}
