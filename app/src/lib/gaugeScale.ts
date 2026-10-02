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

/** Gauge scale mark: `at` is a 0..1 position, `mark` draws a vertical tick. */
export interface Tick {
  at: number;
  label?: string;
  mark?: boolean;
}

const pos = (scaleFn: Scale, v: number): number => scaleFn(v) as number;

/** Light-years; the label is the formatted `value` (language dependent). */
export const DISTANCE_TICKS: readonly (Tick & { value: number })[] = [1, 10, 100, 1000].map(
  (value) => ({ at: pos(distanceScale, value), value, mark: true }),
);

// Conventional approximate MK class boundaries in K, textbook reference values
// (data). Deliberate simplification: O stars (> 30000 K) are off-scale and pile
// up at the right end; upgrade when the scale needs to resolve them.
const SPECTRAL_EDGES_K = [2400, 3700, 5200, 6000, 7500, 10000, 30000];
const SPECTRAL_CLASSES = ['M', 'K', 'G', 'F', 'A', 'B'];

/** Class letters at the geometric centre of their band (the scale is log),
 * marks at the boundaries between classes. */
export const TEMPERATURE_TICKS: readonly Tick[] = SPECTRAL_CLASSES.flatMap((label, i) => {
  const lo = SPECTRAL_EDGES_K[i]!;
  const hi = SPECTRAL_EDGES_K[i + 1]!;
  const ticks: Tick[] = [{ at: pos(temperatureScale, Math.sqrt(lo * hi)), label }];
  if (i < SPECTRAL_CLASSES.length - 1) ticks.push({ at: pos(temperatureScale, hi), mark: true });
  return ticks;
});

export const LUMINOSITY_TICKS: readonly Tick[] = [
  { at: pos(luminosityScale, 0.001), label: '10⁻³', mark: true },
  { at: pos(luminosityScale, 1), label: '1', mark: true },
  { at: pos(luminosityScale, 1000), label: '10³', mark: true },
];

/** The 10 tick is mark-only: its label would collide with the naked-eye label. */
export const MAGNITUDE_TICKS: readonly Tick[] = [0, 10, 20].map((m) => ({
  at: pos(magnitudeScale, m),
  ...(m === 10 ? {} : { label: String(m) }),
  mark: true,
}));

/** Naked-eye limit, magnitude ~6 (conventional dark-sky threshold). */
export const NAKED_EYE_AT = pos(magnitudeScale, 6);
