import { describe, expect, it } from 'vitest';

import { hzInclinationDeg } from '../../src/lib/habitableZone';

describe('hzInclinationDeg', () => {
  it('is the median of the finite values (nulls ignored)', () => {
    expect(hzInclinationDeg([89.7, null, 89.5, 89.9])).toBe(89.7);
  });

  it('returns null when no value is available', () => {
    expect(hzInclinationDeg([])).toBeNull();
    expect(hzInclinationDeg([null, null])).toBeNull();
  });

  it('is robust to an outlier', () => {
    expect(hzInclinationDeg([89, 90, 10])).toBe(89);
  });

  it('averages the two central values for an even count', () => {
    expect(hzInclinationDeg([80, 90])).toBe(85);
  });

  it('ignores NaN and Infinity', () => {
    expect(hzInclinationDeg([NaN, 80, Infinity, 90, -Infinity])).toBe(85);
  });
});
