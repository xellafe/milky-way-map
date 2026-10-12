import { describe, expect, it } from 'vitest';
import { MOBILE_SHORT_SIDE_PX, layoutMode } from '../../src/lib/layoutMode';

describe('layoutMode', () => {
  it.each([
    [375, 812, true, 'portrait'],
    [812, 375, true, 'landscape'],
    [360, 640, true, 'portrait'],
    [640, 360, true, 'landscape'],
    [768, 1024, true, 'desktop'],
    [1280, 720, false, 'desktop'],
    [375, 812, false, 'desktop'],
    [375, 400, true, 'portrait'],
    [599, 900, true, 'portrait'],
    [600, 900, true, 'desktop'],
  ] as const)('(%i, %i, coarse=%s) -> %s', (w, h, coarse, expected) => {
    expect(layoutMode(w, h, coarse)).toBe(expected);
  });

  it('uses a 600 px short-side threshold', () => {
    expect(MOBILE_SHORT_SIDE_PX).toBe(600);
  });
});
