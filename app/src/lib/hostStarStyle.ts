import { STAR_COLOR_GAMMA } from './starColor';

export interface HostStarLook {
  colorGamma: number;
  spots: number;
  coronaIntensity: number;
  pulseAmplitude: number;
  animate: boolean;
}

// Realism mode drops the aesthetic exaggerations (hue gamma, spots, bright
// corona, pulse); reduced motion only stops the animation (SPEC §6.9).
// Tuning values are aesthetic choices, not data: pulseAmplitude 0.1 is a
// relative brightness swing, coronaIntensity a unitless multiplier on the
// corona glow (1 default, 0.5 in realism), spots a unitless 0/1 weight of the
// surface spot pattern.
export function hostStarLook(realism: boolean, reducedMotion: boolean): HostStarLook {
  return {
    colorGamma: realism ? 1 : STAR_COLOR_GAMMA,
    spots: realism ? 0 : 1,
    coronaIntensity: realism ? 0.5 : 1,
    pulseAmplitude: realism || reducedMotion ? 0 : 0.1,
    animate: !reducedMotion,
  };
}

// FNV-1a 32-bit over UTF-16 code units, scaled to [0, 1): a stable per-host
// seed so each star gets its own surface pattern across sessions.
export function hostSeed(hostname: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < hostname.length; i++) {
    h ^= hostname.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}
