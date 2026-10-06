import type { Lim } from './limitedValue';

export type OrbitSense = 'prograde' | 'retrograde';

/** Sense from one obliquity angle in degrees; exactly 90 is ambiguous. */
function senseOf(deg: number | null, lim: Lim): OrbitSense | null {
  // A limit-flagged angle is not a measurement, so it cannot decide the sense.
  if (deg === null || !Number.isFinite(deg) || lim === 1 || lim === -1) return null;
  const a = Math.abs(deg);
  return a < 90 ? 'prograde' : a > 90 ? 'retrograde' : null;
}

/**
 * Orbital sense relative to the stellar spin. The true obliquity psi wins over
 * the sky-projected lambda, which can hide a large psi (Fabrycky & Winn 2009,
 * ApJ 696, 1230; #18). lambda is used only when psi is missing, not finite or
 * limit-flagged; a measured psi of exactly 90 deg is ambiguous, not a fallback.
 */
export function orbitSense(
  trueDeg: number | null,
  trueLim: Lim,
  projDeg: number | null,
  projLim: Lim,
): OrbitSense | null {
  const psiUsable = trueDeg !== null && Number.isFinite(trueDeg) && trueLim !== 1 && trueLim !== -1;
  return psiUsable ? senseOf(trueDeg, trueLim) : senseOf(projDeg, projLim);
}
