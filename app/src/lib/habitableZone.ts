/**
 * Approximate habitable zone (SPEC §6.7): conservative √L bounds, the SAME
 * model the pipeline uses for the per-planet in_hz flag (crossmatch.py):
 * inner flux 1.1 S⊕, outer 0.53 S⊕ → r = sqrt(L / flux) AU.
 * Labelled "approximate model" in the UI. Missing luminosity → null
 * (never guessed, the HZ toggle is disabled).
 */

export const HZ_INNER_FLUX = 1.1;
export const HZ_OUTER_FLUX = 0.53;

export interface HzBounds {
  innerAU: number;
  outerAU: number;
}

/** `stLumLog10` is log10(L/L☉) as provided by pscomppars (st_lum). */
export function hzBoundsAU(stLumLog10: number | null): HzBounds | null {
  if (stLumLog10 === null || !Number.isFinite(stLumLog10)) return null;
  const lum = 10 ** stLumLog10;
  return {
    innerAU: Math.sqrt(lum / HZ_INNER_FLUX),
    outerAU: Math.sqrt(lum / HZ_OUTER_FLUX),
  };
}

/**
 * Median orbital inclination (deg) of a host's planets, used to tilt the HZ
 * ring into the system's median plane. Presentation choice, not data: the
 * longitude of the ascending node Ω is not in the data, so only the inclination i
 * (tilt relative to the sky plane) is known, the same limit as the orbits (SPEC §6.7).
 * No finite value → null (ring stays flat, never guessed).
 */
export function hzInclinationDeg(inclinations: readonly (number | null)[]): number | null {
  const v = inclinations.filter((x): x is number => x !== null && Number.isFinite(x));
  if (v.length === 0) return null;
  v.sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}
