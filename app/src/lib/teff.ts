/**
 * Effective-temperature ESTIMATE from the B–V color index.
 *
 * Model: Ballesteros (2012), EPL 97, 34008 — a blackbody-based fit valid for
 * main-sequence stars roughly in B–V ∈ [-0.4, 2.0]:
 *   T = 4600 K · (1 / (0.92·(B–V) + 1.7) + 1 / (0.92·(B–V) + 0.62))
 * Sun check: B–V 0.656 → ≈ 5770 K.
 *
 * This is an ESTIMATE and must be labelled as such in the UI (SPEC §6.6).
 * Missing B–V → null, never fabricated (SPEC §0.7).
 */
export function estimateTeffFromBV(colorIndex: number): number | null {
  if (!Number.isFinite(colorIndex)) return null;
  const bv = colorIndex;
  const teff = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  // Outside the fit's sanity range the estimate is meaningless: report n/d.
  if (!Number.isFinite(teff) || teff < 1000 || teff > 60_000) return null;
  return teff;
}
