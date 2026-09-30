// Gauge scales map a physical value to a 0..1 needle position. The ranges
// below are display choices (aesthetic, not data): out-of-range values clamp
// to the ends. Missing or non-finite input yields null, never a made-up
// position (AGENTS rule 5). See #3.

type Scale = (v: number | null | undefined) => number | null;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function scale(map: (v: number) => number): Scale {
  return (v) => (v == null || !Number.isFinite(v) ? null : clamp01(map(v)));
}

function logScale(min: number, max: number): Scale {
  const lo = Math.log10(min);
  const span = Math.log10(max) - lo;
  // Non-positive values have no logarithm; they sit at the low end.
  return scale((v) => (v <= 0 ? 0 : (Math.log10(v) - lo) / span));
}

function linearScale(min: number, max: number): Scale {
  return scale((v) => (v - min) / (max - min));
}

/** Light-years, log, 1..1000 (aesthetic choice, not data). */
export const distanceScale = logScale(1, 1000);

/** Kelvin, log, 2400..30000 (aesthetic choice, not data); M left, O/B right. */
export const temperatureScale = logScale(2400, 30000);

/** Solar luminosities, log, 0.001..1000 (aesthetic choice, not data). */
export const luminosityScale = logScale(0.001, 1000);

/** Apparent magnitude, linear, -1..20 (aesthetic choice, not data). */
export const magnitudeScale = linearScale(-1, 20);

/** Naked-eye limit, magnitude ~6 (conventional dark-sky threshold). */
export const NAKED_EYE_TICK = magnitudeScale(6) as number;
