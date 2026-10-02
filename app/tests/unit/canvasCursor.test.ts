import { describe, expect, it } from 'vitest';
import { canvasCursor } from '../../src/lib/canvasCursor';

describe('canvasCursor', () => {
  it.each([
    [false, false, 'grab'],
    [false, true, 'pointer'],
    [true, false, 'grabbing'],
    [true, true, 'grabbing'],
  ] as const)('dragging=%s overTarget=%s -> %s', (dragging, overTarget, expected) => {
    expect(canvasCursor(dragging, overTarget)).toBe(expected);
  });
});
