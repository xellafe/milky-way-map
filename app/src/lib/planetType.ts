/**
 * Coarse exoplanet size class for the System View type filter.
 *
 * DATA ASSUMPTIONS (documented, not physical truth):
 * - Radius first (pl_rade, Earth radii): rocky < 1.6 R⊕ (Fulton radius gap),
 *   sub-Neptune 1.6–4 R⊕, giant ≥ 4 R⊕ (Neptune-size and up).
 * - Mass fallback (pl_bmasse, Earth masses) when the radius is missing, the
 *   same boundaries mapped through the Chen & Kipping (2017) mass–radius
 *   relation: 1.6 R⊕ ≈ 3 M⊕, 4 R⊕ ≈ 15 M⊕. For RV planets pl_bmasse is often
 *   a MINIMUM mass (M·sin i), so the class may be underestimated.
 * - Neither known → 'unknown', never guessed.
 */
export type PlanetType = 'rocky' | 'subNeptune' | 'giant' | 'unknown';

export const PLANET_TYPES: readonly PlanetType[] = ['rocky', 'subNeptune', 'giant', 'unknown'];

const ROCKY_MAX_REARTH = 1.6;
const GIANT_MIN_REARTH = 4;
const ROCKY_MAX_MEARTH = 3;
const GIANT_MIN_MEARTH = 15;

export function classifyPlanet(p: {
  pl_rade: number | null;
  pl_bmasse: number | null;
}): PlanetType {
  if (p.pl_rade !== null) {
    if (p.pl_rade < ROCKY_MAX_REARTH) return 'rocky';
    return p.pl_rade < GIANT_MIN_REARTH ? 'subNeptune' : 'giant';
  }
  if (p.pl_bmasse !== null) {
    if (p.pl_bmasse < ROCKY_MAX_MEARTH) return 'rocky';
    return p.pl_bmasse < GIANT_MIN_MEARTH ? 'subNeptune' : 'giant';
  }
  return 'unknown';
}
