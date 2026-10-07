import { describe, expect, it } from 'vitest';

import { approachTarget, followStep } from '../../src/lib/follow';

describe('followStep', () => {
  it('moves the target onto the planet and translates the camera by the same delta', () => {
    expect(followStep([10, 0, 0], [0, 0, 0], [1, 2, 3])).toEqual({
      camera: [11, 2, 3],
      target: [1, 2, 3],
    });
  });

  it('keeps the camera still when the planet does not move', () => {
    expect(followStep([5, 5, 5], [1, 1, 1], [1, 1, 1])).toEqual({
      camera: [5, 5, 5],
      target: [1, 1, 1],
    });
  });
});

describe('approachTarget', () => {
  const a = [0, 0, 0] as const;
  const b = [4, -2, 6] as const;

  it('starts at the start point and ends on the planet', () => {
    expect(approachTarget(a, b, 0)).toEqual([0, 0, 0]);
    expect(approachTarget(a, b, 1)).toEqual([4, -2, 6]);
  });

  it('eases through the midpoint', () => {
    const mid = approachTarget(a, b, 0.5);
    expect(mid[0]).toBeCloseTo(2, 9);
    expect(mid[1]).toBeCloseTo(-1, 9);
    expect(mid[2]).toBeCloseTo(3, 9);
  });
});
