import { describe, expect, it } from 'vitest';
import {
  PINCH_SECONDS_PER_PX,
  pinchAdvanceLy,
  pinchDistance,
  pinchDollyFactor,
} from '../../src/lib/pinch';

describe('pinchDistance', () => {
  it('is the Euclidean distance between two touch points', () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('pinchDollyFactor', () => {
  it('is prev/cur: fingers spreading gives a factor below 1 (closer)', () => {
    expect(pinchDollyFactor(100, 200)).toBe(0.5);
    expect(pinchDollyFactor(200, 100)).toBe(2);
  });

  it('is neutral when either distance is not positive', () => {
    expect(pinchDollyFactor(0, 100)).toBe(1);
    expect(pinchDollyFactor(100, 0)).toBe(1);
  });
});

describe('pinchAdvanceLy', () => {
  it('maps pixel change to seconds of W at the movement speed', () => {
    expect(PINCH_SECONDS_PER_PX).toBe(0.01);
    expect(pinchAdvanceLy(100, 200, 10)).toBeCloseTo(10, 10);
    expect(pinchAdvanceLy(200, 100, 10)).toBeCloseTo(-10, 10);
    expect(pinchAdvanceLy(100, 100, 10)).toBe(0);
  });
});
