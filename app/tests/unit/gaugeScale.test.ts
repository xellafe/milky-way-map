import { describe, expect, it } from 'vitest';
import {
  NAKED_EYE_TICK,
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
    expect(NAKED_EYE_TICK).toBeCloseTo(1 / 3);
  });
});
