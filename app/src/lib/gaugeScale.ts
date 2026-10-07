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

/** Apparent magnitude, linear, inverted: 20 at the left end, -1 at the right,
 * so brighter stars sit further right like the other gauges (human choice, #23). */
export const magnitudeScale = linearScale(20, -1);

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

/** Naked-eye limit, magnitude ~6 (convention, dark sky). */
export const NAKED_EYE_LIMIT_MAG = 6;
/** Binocular limit, magnitude ~9 (approximate convention: depends on instrument and sky). */
export const BINOCULAR_LIMIT_MAG = 9;

/** The 10 tick is mark-only: 10 and 9 are ~10 px apart and their labels would collide. */
export const MAGNITUDE_TICKS: readonly Tick[] = [20, 10, 9, 6, -1].map((m) => ({
  at: pos(magnitudeScale, m),
  ...(m === 10 ? {} : { label: String(m).replace('-', '−') }),
  mark: true,
}));

export type VisibilityZone = 'nakedEye' | 'binocular';

export const MAGNITUDE_ZONES: readonly { from: number; to: number; kind: VisibilityZone }[] = [
  {
    from: pos(magnitudeScale, NAKED_EYE_LIMIT_MAG),
    to: pos(magnitudeScale, -1),
    kind: 'nakedEye',
  },
  {
    from: pos(magnitudeScale, BINOCULAR_LIMIT_MAG),
    to: pos(magnitudeScale, NAKED_EYE_LIMIT_MAG),
    kind: 'binocular',
  },
];

export function visibilityVerdict(
  mag: number | null | undefined,
): VisibilityZone | 'telescope' | null {
  if (mag == null || !Number.isFinite(mag)) return null;
  return mag <= NAKED_EYE_LIMIT_MAG
    ? 'nakedEye'
    : mag <= BINOCULAR_LIMIT_MAG
      ? 'binocular'
      : 'telescope';
}

/** Earth radii, log, 0.3..30 (aesthetic choice, not data). */
export const planetRadiusScale = logScale(0.3, 30);

/** Earth masses, log, 0.1..1e4 (aesthetic choice, not data). */
export const planetMassScale = logScale(0.1, 1e4);

/** Days, log, 0.1..1e5 (aesthetic choice, not data). */
export const orbitalPeriodScale = logScale(0.1, 1e5);

/** Kelvin, log, 50..3000 (aesthetic choice, not data). */
export const eqTempScale = logScale(50, 3000);

// Reference bodies (data): equatorial radii, the NASA Exoplanet Archive convention.
export const PLANET_RADIUS_TICKS: readonly Tick[] = [
  { at: pos(planetRadiusScale, 1), label: '⊕', mark: true },
  { at: pos(planetRadiusScale, 3.883), label: '♆', mark: true },
  { at: pos(planetRadiusScale, 11.209), label: '♃', mark: true },
];

// Earth masses (data): reference bodies as above.
export const PLANET_MASS_TICKS: readonly Tick[] = [
  { at: pos(planetMassScale, 1), label: '⊕', mark: true },
  { at: pos(planetMassScale, 17.15), label: '♆', mark: true },
  { at: pos(planetMassScale, 317.83), label: '♃', mark: true },
];

/** Days; 365.25 d is the Julian year (convention). The label is i18n (`gauge.oneDay`, `gauge.oneYear`), set by the tile. */
export const PERIOD_TICKS: readonly (Tick & { labelKey: string })[] = [
  { at: pos(orbitalPeriodScale, 1), labelKey: 'gauge.oneDay', mark: true },
  { at: pos(orbitalPeriodScale, 365.25), labelKey: 'gauge.oneYear', mark: true },
];

/** Earth's equilibrium temperature, 255 K (Bond albedo 0.3; data). */
export const EQ_TEMP_TICKS: readonly Tick[] = [
  { at: pos(eqTempScale, 255), label: '⊕', mark: true },
];
