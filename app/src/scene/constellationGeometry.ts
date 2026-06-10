import * as THREE from 'three';
import type { Constellation } from '../data/constellations';

/**
 * Builds the LineSegments geometry for the constellation stick figures:
 * each polyline [a, b, c] becomes the segment pairs (a,b), (b,c), with the
 * endpoints' 3D positions read from the star SoA (always in sync with the
 * rendered cloud). One geometry for all 88 constellations = one draw call.
 */
export function buildConstellationGeometry(
  constellations: Constellation[],
  starPositions: Float32Array,
): THREE.BufferGeometry {
  let segments = 0;
  for (const con of constellations) {
    for (const line of con.lines) segments += Math.max(line.length - 1, 0);
  }
  const positions = new Float32Array(segments * 6);
  let cursor = 0;
  const starCount = starPositions.length / 3;
  for (const con of constellations) {
    for (const line of con.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        for (const starIndex of [line[i]!, line[i + 1]!]) {
          // Out-of-range indices would silently read NaN/undefined: guard.
          if (starIndex < 0 || starIndex >= starCount) {
            throw new Error(`constellation line star index out of range: ${starIndex}`);
          }
          positions[cursor++] = starPositions[starIndex * 3]!;
          positions[cursor++] = starPositions[starIndex * 3 + 1]!;
          positions[cursor++] = starPositions[starIndex * 3 + 2]!;
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
