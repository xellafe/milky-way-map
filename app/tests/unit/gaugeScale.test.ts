import { describe, expect, it } from 'vitest';
import {
  DISTANCE_TICKS,
  LUMINOSITY_TICKS,
  BINOCULAR_LIMIT_MAG,
  MAGNITUDE_TICKS,
  MAGNITUDE_ZONES,
  NAKED_EYE_LIMIT_MAG,
  TEMPERATURE_TICKS,
  EQ_TEMP_TICKS,
  PERIOD_TICKS,
  PLANET_MASS_TICKS,
  STELLAR_RADIUS_TICKS,
  stellarRadiusScale,
  PLANET_RADIUS_TICKS,
  eqTempScale,
  orbitalPeriodScale,
  planetMassScale,
  planetRadiusScale,
  distanceScale,
  luminosityScale,
  magnitudeScale,
  temperatureScale,
  visibilityVerdict,
} from '../../src/lib/gaugeScale';

describe('gaugeScale', () => {
  it.each([null, undefined, NaN, Infinity])('%s → null', (v) => {
    for (const f of [distanceScale, temperatureScale, luminosityScale, magnitudeScale])
      expect(f(v as number)).toBeNull();
  });
  it('distance: log 1→1000 ly', () => {
    expect(distanceScale(1)).toBe(0);
    expect(distanceScale(1000)).toBe(1);
    expect(distanceScale(31.6227766)).toBeCloseTo(0.5);
    expect(distanceScale(0.5)).toBe(0);
    expect(distanceScale(5000)).toBe(1);
  });
  it('temperature: log 2400→30000 K', () => {
    expect(temperatureScale(2400)).toBe(0);
    expect(temperatureScale(30000)).toBe(1);
    expect(temperatureScale(Math.sqrt(2400 * 30000))).toBeCloseTo(0.5);
  });
  it('luminosity: Sun at 0.5, non-positive clamps to 0', () => {
    expect(luminosityScale(1)).toBeCloseTo(0.5);
    expect(luminosityScale(0.001)).toBe(0);
    expect(luminosityScale(1000)).toBe(1);
    expect(luminosityScale(0)).toBe(0);
  });
  it('magnitude: inverted linear axis, 20 → 0, −1 → 1 (#23)', () => {
    expect(magnitudeScale(20)).toBe(0);
    expect(magnitudeScale(-1)).toBe(1);
    expect(magnitudeScale(6)).toBeCloseTo(2 / 3, 9);
  });

  it('visibility limits are 6 (naked eye) and 9 (binoculars)', () => {
    expect(NAKED_EYE_LIMIT_MAG).toBe(6);
    expect(BINOCULAR_LIMIT_MAG).toBe(9);
  });

  it('magnitude zones: naked eye pos(6)..pos(−1), binocular pos(9)..pos(6)', () => {
    expect(MAGNITUDE_ZONES).toHaveLength(2);
    const naked = MAGNITUDE_ZONES.find((z) => z.kind === 'nakedEye')!;
    const bino = MAGNITUDE_ZONES.find((z) => z.kind === 'binocular')!;
    expect(naked.from).toBeCloseTo(magnitudeScale(6) as number, 9);
    expect(naked.to).toBeCloseTo(magnitudeScale(-1) as number, 9);
    expect(bino.from).toBeCloseTo(magnitudeScale(9) as number, 9);
    expect(bino.to).toBeCloseTo(magnitudeScale(6) as number, 9);
  });

  it('visibilityVerdict thresholds', () => {
    expect(visibilityVerdict(6)).toBe('nakedEye');
    expect(visibilityVerdict(6.01)).toBe('binocular');
    expect(visibilityVerdict(9)).toBe('binocular');
    expect(visibilityVerdict(9.01)).toBe('telescope');
    expect(visibilityVerdict(null)).toBeNull();
    expect(visibilityVerdict(undefined)).toBeNull();
    expect(visibilityVerdict(NaN)).toBeNull();
  });

  describe('ticks', () => {
    const all = [DISTANCE_TICKS, TEMPERATURE_TICKS, LUMINOSITY_TICKS, MAGNITUDE_TICKS];

    it('every position is within 0..1', () => {
      for (const ticks of all) {
        for (const t of ticks) {
          expect(t.at).toBeGreaterThanOrEqual(0);
          expect(t.at).toBeLessThanOrEqual(1);
        }
      }
    });

    it('distance: 1, 10, 100, 1000 ly at 0, 1/3, 2/3, 1, all marked', () => {
      expect(DISTANCE_TICKS.map((t) => t.value)).toEqual([1, 10, 100, 1000]);
      [0, 1 / 3, 2 / 3, 1].forEach((at, i) => expect(DISTANCE_TICKS[i]!.at).toBeCloseTo(at));
      expect(DISTANCE_TICKS.every((t) => t.mark)).toBe(true);
    });

    it('luminosity: 10⁻³, 1, 10³ at 0, 0.5, 1, all marked', () => {
      expect(LUMINOSITY_TICKS.map((t) => t.label)).toEqual(['10⁻³', '1', '10³']);
      [0, 0.5, 1].forEach((at, i) => expect(LUMINOSITY_TICKS[i]!.at).toBeCloseTo(at));
      expect(LUMINOSITY_TICKS.every((t) => t.mark)).toBe(true);
    });

    it('magnitude: ticks 20, 10, 9, 6, −1 on the inverted axis, all marked, 10 unlabelled', () => {
      expect(MAGNITUDE_TICKS.map((t) => t.label)).toEqual(['20', undefined, '9', '6', '−1']);
      [20, 10, 9, 6, -1].forEach((m, i) =>
        expect(MAGNITUDE_TICKS[i]!.at).toBeCloseTo(magnitudeScale(m) as number),
      );
      expect(MAGNITUDE_TICKS.every((t) => t.mark)).toBe(true);
    });

    it('temperature: M K G F A B labels sit between their class boundaries', () => {
      const labelled = TEMPERATURE_TICKS.filter((t) => t.label);
      expect(labelled.map((t) => t.label)).toEqual(['M', 'K', 'G', 'F', 'A', 'B']);
      // Unlabelled marks: M|K, K|G, G|F, F|A, A|B boundaries.
      const marks = TEMPERATURE_TICKS.filter((t) => t.mark && !t.label).map((t) => t.at);
      expect(marks).toHaveLength(5);
      marks.forEach((m, i) => i > 0 && expect(m).toBeGreaterThan(marks[i - 1]!));
      const edges = [0, ...marks, 1];
      labelled.forEach((t, i) => {
        expect(t.at).toBeGreaterThan(edges[i]!);
        expect(t.at).toBeLessThan(edges[i + 1]!);
      });
      // Reference MK boundaries (K).
      [3700, 5200, 6000, 7500, 10000].forEach((k, i) =>
        expect(marks[i]).toBeCloseTo(temperatureScale(k) as number),
      );
      // Labels at the geometric (log) centre of each band.
      const bands = [2400, 3700, 5200, 6000, 7500, 10000, 30000];
      labelled.forEach((t, i) =>
        expect(t.at).toBeCloseTo(temperatureScale(Math.sqrt(bands[i]! * bands[i + 1]!)) as number),
      );
    });
  });
});

describe('planet gauge scales (#23)', () => {
  it('radius: log 0.3→30 R⊕, Earth at the log midpoint offset', () => {
    expect(planetRadiusScale(1)).toBeCloseTo(Math.log10(1 / 0.3) / 2);
    expect(planetRadiusScale(0.3)).toBe(0);
    expect(planetRadiusScale(30)).toBe(1);
  });
  it('mass: log 0.1→1e4 M⊕', () => {
    expect(planetMassScale(0.1)).toBeCloseTo(0);
    expect(planetMassScale(1e4)).toBeCloseTo(1);
  });
  it('period: 365.25 d sits inside the scale', () => {
    const v = orbitalPeriodScale(365.25)!;
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
  it('null / non-finite input → null', () => {
    for (const f of [planetRadiusScale, planetMassScale, orbitalPeriodScale, eqTempScale])
      expect(f(null)).toBeNull();
  });
  it.each([
    ['radius', PLANET_RADIUS_TICKS],
    ['mass', PLANET_MASS_TICKS],
    ['period', PERIOD_TICKS],
    ['eqt', EQ_TEMP_TICKS],
  ])('%s ticks are increasing and within [0, 1]', (_n, ticks) => {
    expect(ticks.length).toBeGreaterThan(0);
    ticks.forEach((t, i) => {
      expect(t.at).toBeGreaterThanOrEqual(0);
      expect(t.at).toBeLessThanOrEqual(1);
      if (i > 0) expect(t.at).toBeGreaterThan(ticks[i - 1]!.at);
    });
  });
});

describe('stellar radius scale (#23)', () => {
  // logScale(0.1, 100) in R_sun: 3 decades, so 1 R_sun sits a third of the way.
  it('maps 0.1..100 R_sun logarithmically onto 0..1', () => {
    expect(stellarRadiusScale(0.1)).toBeCloseTo(0, 10);
    expect(stellarRadiusScale(1)).toBeCloseTo(1 / 3, 10);
    expect(stellarRadiusScale(10)).toBeCloseTo(2 / 3, 10);
    expect(stellarRadiusScale(100)).toBeCloseTo(1, 10);
  });
  it('returns null for missing values and clamps out-of-range ones', () => {
    expect(stellarRadiusScale(null)).toBeNull();
    expect(stellarRadiusScale(1000)).toBe(1);
  });
  it('has marks at 0.1, 1, 10 and 100 R_sun', () => {
    expect(STELLAR_RADIUS_TICKS.map((t) => t.at)).toEqual(
      [0.1, 1, 10, 100].map((v) => stellarRadiusScale(v)),
    );
  });
});
