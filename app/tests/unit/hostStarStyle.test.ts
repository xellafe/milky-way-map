import { describe, expect, it } from 'vitest';
import { hostSeed, hostStarLook } from '../../src/lib/hostStarStyle';
import { STAR_COLOR_GAMMA } from '../../src/lib/starColor';

describe('hostStarLook', () => {
  it('exposes the cloud color gamma', () => {
    expect(STAR_COLOR_GAMMA).toBe(2.5);
  });

  it.each([
    [
      false,
      false,
      { colorGamma: 3.1, spots: 1, coronaIntensity: 1, pulseAmplitude: 0.1, animate: true },
    ],
    [
      true,
      false,
      { colorGamma: 1, spots: 0, coronaIntensity: 0.5, pulseAmplitude: 0, animate: true },
    ],
    [
      false,
      true,
      { colorGamma: 3.1, spots: 1, coronaIntensity: 1, pulseAmplitude: 0, animate: false },
    ],
    [
      true,
      true,
      { colorGamma: 1, spots: 0, coronaIntensity: 0.5, pulseAmplitude: 0, animate: false },
    ],
  ])('realism=%s reducedMotion=%s', (realism, reducedMotion, expected) => {
    expect(hostStarLook(realism, reducedMotion, 3.1)).toEqual(expected);
  });
});

describe('hostStarLook color saturation', () => {
  it('passes the saturation through as colorGamma, including 0', () => {
    expect(hostStarLook(false, false, 0).colorGamma).toBe(0);
    expect(hostStarLook(false, false, 4).colorGamma).toBe(4);
  });

  it('forces catalog colors (gamma 1) with realism', () => {
    expect(hostStarLook(true, false, 4).colorGamma).toBe(1);
  });
});

describe('hostSeed', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = hostSeed('TRAPPIST-1');
    expect(hostSeed('TRAPPIST-1')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('differs between hosts', () => {
    expect(hostSeed('TRAPPIST-1')).not.toBe(hostSeed('Kepler-90'));
  });

  it('handles the empty string', () => {
    const s = hostSeed('');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(1);
  });
});
