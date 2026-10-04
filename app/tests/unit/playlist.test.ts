import { describe, expect, it } from 'vitest';

import { nextIndex, prevIndex } from '../../src/lib/playlist';

describe('playlist index helpers', () => {
  it('stays on the only track', () => {
    expect(nextIndex(0, 1)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
  });

  it('wraps around a multi-track list', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });
});
