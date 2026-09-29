/**
 * Presentational planet/orbit styling for the System View (issue #2).
 * AESTHETIC ONLY: pscomppars has no planet colors or surface data. The look
 * derives from the size class (classifyPlanet) plus a per-planet seed from
 * the name, so planets of the same class differ without inventing data.
 */
import type { PlanetType } from './planetType';

export type OrbitStyle = 'trail' | 'thick' | 'simple';
export const ORBIT_STYLES: readonly OrbitStyle[] = ['trail', 'thick', 'simple'];

/** Shader switch value for `uType` in planet.frag (keep in sync). */
export const PLANET_TYPE_INDEX: Record<PlanetType, number> = {
  rocky: 0,
  subNeptune: 1,
  giant: 2,
  unknown: 3,
};

/** Base surface colors [A, B, C] per class, hue-jittered by the seed. */
export const PLANET_PALETTE: Record<PlanetType, [number, number, number]> = {
  rocky: [0x6e5a4a, 0xb08a64, 0xd9c7a8],
  subNeptune: [0x5f9fcf, 0x9fd0ee, 0xe4f4ff],
  giant: [0xc9a06e, 0xf0dcb8, 0xb86a3c],
  unknown: [0x8f8f8f, 0xa8a8a8, 0xc0c0c0],
};

/** Orbit line tint per class. */
export const ORBIT_TINT: Record<PlanetType, number> = {
  rocky: 0xc8a27a,
  subNeptune: 0x7fb8e0,
  giant: 0xe0b070,
  unknown: 0x8a8a8a,
};

/** Trail length behind the planet, radians of orbit angle. */
export const TRAIL_LENGTH_RAD = Math.PI / 2;
/** Opacity of the full orbit under the trail. */
export const TRAIL_BASE_OPACITY = 0.25;

/** Deterministic seed in [0, 1) from a planet name (FNV-1a 32-bit). */
export function nameSeed(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Trail intensity at an orbit vertex: 1 at the planet, fading linearly to 0
 * TRAIL_LENGTH_RAD behind it (motion = increasing angle), 0 ahead of it.
 * Mirrors orbit-trail.frag.
 */
export function trailAlpha(vertexAngleRad: number, planetAngleRad: number): number {
  const TAU = 2 * Math.PI;
  const behind = (((planetAngleRad - vertexAngleRad) % TAU) + TAU) % TAU;
  return behind <= TRAIL_LENGTH_RAD ? 1 - behind / TRAIL_LENGTH_RAD : 0;
}

/** Orbit-plane angle in [0, 2π) of a focus-centred point (matches the path sampling). */
export function planeAngle(x: number, y: number): number {
  const a = Math.atan2(y, x);
  return a < 0 ? a + 2 * Math.PI : a;
}
