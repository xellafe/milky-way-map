import { describe, expect, it } from 'vitest';
import { spectralChipColor } from '../../src/lib/spectralChip';
import { teffToColor } from '../../src/lib/starColor';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, b: n & 255 };
};

describe('spectralChipColor', () => {
  it('uses the representative Teff of the class', () => {
    expect(spectralChipColor('G')).toBe('#' + teffToColor(5600).toString(16).padStart(6, '0'));
  });

  it('is blue-ish for O and red-ish for M', () => {
    const o = rgb(spectralChipColor('O'));
    const m = rgb(spectralChipColor('M'));
    expect(o.b).toBeGreaterThan(o.r);
    expect(m.r).toBeGreaterThan(m.b);
  });
});
