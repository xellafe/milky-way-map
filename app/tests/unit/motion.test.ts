import { describe, expect, it } from 'vitest';
import { effectiveTwinkle } from '../../src/lib/motion';

const off = { reducedMotion: false, realism: false, mobile: false };

describe('effectiveTwinkle', () => {
  it('keeps the amplitude when nothing suppresses it', () => {
    expect(effectiveTwinkle(0.35, off)).toBe(0.35);
  });
  it('is 0 under reduced motion', () => {
    expect(effectiveTwinkle(0.35, { ...off, reducedMotion: true })).toBe(0);
  });
  it('is 0 in realism mode', () => {
    expect(effectiveTwinkle(0.35, { ...off, realism: true })).toBe(0);
  });
  it('is 0 on phones', () => {
    expect(effectiveTwinkle(0.35, { ...off, mobile: true })).toBe(0);
  });
});
