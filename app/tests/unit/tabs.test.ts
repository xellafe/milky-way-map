import { describe, expect, it } from 'vitest';

import { nextTabIndex } from '../../src/lib/tabs';

describe('nextTabIndex', () => {
  it('cycles forward and backward', () => {
    expect(nextTabIndex(2, 'ArrowRight', 3)).toBe(0);
    expect(nextTabIndex(0, 'ArrowLeft', 3)).toBe(2);
    expect(nextTabIndex(0, 'ArrowRight', 3)).toBe(1);
  });
  it('jumps to the ends with Home/End', () => {
    expect(nextTabIndex(1, 'Home', 3)).toBe(0);
    expect(nextTabIndex(0, 'End', 3)).toBe(2);
  });
  it('ignores other keys', () => {
    expect(nextTabIndex(1, 'a', 3)).toBeNull();
  });
});
