import { describe, expect, it } from 'vitest';
import { limitPrefix } from '../../src/lib/limitedValue';

describe('limitPrefix', () => {
  it('maps limit flags to prefixes', () => {
    expect(limitPrefix(1)).toBe('<');
    expect(limitPrefix(-1)).toBe('>');
    expect(limitPrefix(0)).toBe('');
    expect(limitPrefix(null)).toBe('');
  });
});
