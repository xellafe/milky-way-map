import { describe, expect, it } from 'vitest';
import { limitPrefix, metallicityRatioTag } from '../../src/lib/limitedValue';

describe('limitPrefix', () => {
  it('maps limit flags to prefixes', () => {
    expect(limitPrefix(1)).toBe('<');
    expect(limitPrefix(-1)).toBe('>');
    expect(limitPrefix(0)).toBe('');
    expect(limitPrefix(null)).toBe('');
  });
});

describe('metallicityRatioTag', () => {
  it('keeps only the two ratios the archive defines', () => {
    expect(metallicityRatioTag('[Fe/H]')).toBe('[Fe/H]');
    expect(metallicityRatioTag('[M/H]')).toBe('[M/H]');
  });
  it('returns null when the ratio is absent or unknown, so no label is guessed', () => {
    expect(metallicityRatioTag(null)).toBeNull();
    expect(metallicityRatioTag('')).toBeNull();
    expect(metallicityRatioTag('[X/H]')).toBeNull();
  });
});
