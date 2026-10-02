import { describe, expect, it } from 'vitest';

import { overlaySide } from '../../src/lib/overlayPlacement';

describe('overlaySide', () => {
  it('places right when it fits, left otherwise', () => {
    expect(overlaySide(100, 200, 40, 1000)).toBe('right');
    expect(overlaySide(800, 200, 40, 1000)).toBe('left');
    expect(overlaySide(760, 200, 40, 1000)).toBe('right'); // exactly fits
  });
});
