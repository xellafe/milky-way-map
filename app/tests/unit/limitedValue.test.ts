import { describe, expect, it } from 'vitest';
import { formatLimited, limitPrefix, metallicityRatioTag } from '../../src/lib/limitedValue';

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

describe('formatLimited', () => {
  it('formats a measured value with the requested significant digits', () => {
    expect(formatLimited(0.05234, 0, 'en-US', 3)).toBe('0.0523');
    expect(formatLimited(7.61, null, 'en-US', 2)).toBe('7.6');
  });
  it('prefixes upper and lower limits', () => {
    expect(formatLimited(7.6, 1, 'en-US', 3)).toBe('<7.6');
    expect(formatLimited(7.6, -1, 'en-US', 3)).toBe('>7.6');
  });
  it('appends the unit', () => {
    expect(formatLimited(7.6, 1, 'en-US', 3, 'Gyr')).toBe('<7.6 Gyr');
  });
  it('returns null for a missing or non-finite value', () => {
    expect(formatLimited(null, 1, 'en-US', 3, 'Gyr')).toBeNull();
    expect(formatLimited(NaN, 0, 'en-US', 3)).toBeNull();
  });
});
