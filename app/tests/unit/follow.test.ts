import { describe, expect, it } from 'vitest';

import { approachTarget, followStep, followViewShift } from '../../src/lib/follow';
import { CARD_GAP_PX, RING_HALF_PX } from '../../src/lib/selectionGeometry';

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

describe('followViewShift', () => {
  const CARD = 470; // widest (Advanced) planet card, px

  it('does not shift when the card fits beside the centred planet (1920 geometry)', () => {
    expect(followViewShift({ left: 0, right: 1608 }, 1920, CARD, CARD_GAP_PX)).toBe(0);
  });

  it('shifts the planet left so the card edge touches the area (1280 geometry)', () => {
    const shift = followViewShift({ left: 0, right: 968 }, 1280, CARD, CARD_GAP_PX);
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeCloseTo(1280 / 2 - (968 - CARD - CARD_GAP_PX), 10);
  });

  it('keeps the planet right of the left panel at 1024 geometry', () => {
    // Panels of 18 rem leave the usable area 312..712 at a 1024 px width.
    const area = { left: 312, right: 712 };
    const shift = followViewShift(area, 1024, CARD, CARD_GAP_PX);
    expect(shift).toBeGreaterThanOrEqual(0);
    // The followed planet sits at width / 2 - shift on screen.
    expect(1024 / 2 - shift).toBeGreaterThanOrEqual(area.left + RING_HALF_PX);
  });

  it('keeps the planet right of area.left for narrow desktop widths', () => {
    for (const width of [1024, 1100, 1210]) {
      const area = { left: 312, right: width - 312 };
      const shift = followViewShift(area, width, CARD, CARD_GAP_PX);
      expect(shift).toBeGreaterThanOrEqual(0);
      expect(width / 2 - shift).toBeGreaterThanOrEqual(area.left + RING_HALF_PX);
    }
  });

  it('never returns a negative shift', () => {
    for (const right of [300, 968, 1500, 1608, 5000])
      for (const width of [800, 1280, 1920])
        expect(
          followViewShift({ left: 0, right }, width, CARD, CARD_GAP_PX),
        ).toBeGreaterThanOrEqual(0);
  });
});
