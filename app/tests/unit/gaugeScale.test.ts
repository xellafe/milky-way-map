import { describe, expect, it } from 'vitest';
import {
  DISTANCE_TICKS,
  LUMINOSITY_TICKS,
  MAGNITUDE_TICKS,
  NAKED_EYE_AT,
  TEMPERATURE_TICKS,
  distanceScale,
  luminosityScale,
  magnitudeScale,
  temperatureScale,
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
  it('magnitude: linear −1→20, naked-eye tick at 6', () => {
    expect(magnitudeScale(-1)).toBe(0);
    expect(magnitudeScale(20)).toBe(1);
    expect(NAKED_EYE_AT).toBeCloseTo(1 / 3);
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
      expect(NAKED_EYE_AT).toBeGreaterThan(0);
      expect(NAKED_EYE_AT).toBeLessThan(1);
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

    it('magnitude: 0 and 20 labelled, 10 mark-only, all marked', () => {
      expect(MAGNITUDE_TICKS.map((t) => t.label)).toEqual(['0', undefined, '20']);
      [0, 10, 20].forEach((m, i) =>
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
