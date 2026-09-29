import { describe, expect, it } from 'vitest';
import { nameSeed, planeAngle, TRAIL_LENGTH_RAD, trailAlpha } from '../../src/lib/planetStyle';

describe('nameSeed', () => {
  it('is deterministic and in [0, 1)', () => {
    expect(nameSeed('TRAPPIST-1 e')).toBe(nameSeed('TRAPPIST-1 e'));
    for (const n of ['a', 'TRAPPIST-1 b', 'Proxima Cen d', '']) {
      expect(nameSeed(n)).toBeGreaterThanOrEqual(0);
      expect(nameSeed(n)).toBeLessThan(1);
    }
  });

  it('differs between sibling planets', () => {
    const seeds = 'bcdefgh'.split('').map((l) => nameSeed(`TRAPPIST-1 ${l}`));
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe('trailAlpha', () => {
  it('is 1 at the planet and fades to 0 behind it', () => {
    expect(trailAlpha(1, 1)).toBe(1);
    expect(trailAlpha(1 - TRAIL_LENGTH_RAD / 2, 1)).toBeCloseTo(0.5);
    expect(trailAlpha(1 - TRAIL_LENGTH_RAD - 0.01, 1)).toBe(0);
  });

  it('is 0 ahead of the planet', () => {
    expect(trailAlpha(1.2, 1)).toBe(0);
  });

  it('wraps across 0 / 2π', () => {
    expect(trailAlpha(2 * Math.PI - TRAIL_LENGTH_RAD / 4, TRAIL_LENGTH_RAD / 4)).toBeCloseTo(0.5);
  });
});

describe('planeAngle', () => {
  it('maps to [0, 2π)', () => {
    expect(planeAngle(1, 0)).toBe(0);
    expect(planeAngle(0, 1)).toBeCloseTo(Math.PI / 2);
    expect(planeAngle(0, -1)).toBeCloseTo((3 * Math.PI) / 2);
  });
});
