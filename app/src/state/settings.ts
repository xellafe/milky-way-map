import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrbitStyle } from '../lib/planetStyle';

/**
 * User customizations (issue #1), persisted in localStorage. Defaults equal
 * the previously hard-coded tuning, so an untouched app looks the same.
 * Everything here is read per frame / pushed to shader uniforms: changing a
 * value never reloads data.
 */
export interface Settings {
  /** Free-fly translation speed, ly per second. */
  moveSpeedLyPerS: number;
  /** Ambient camera revolution around a freshly locked star. */
  autoOrbit: boolean;
  /** Realism: no hue exaggeration, no twinkle, no fireball core/corona. */
  realism: boolean;
  /** Time scale of the twinkle waves (1 = shader base frequencies). */
  twinkleSpeed: number;
  /** Twinkle brightness swing (0 = off). */
  twinkleAmplitude: number;
  /** Star size contrast exponent (>1 widens the size range). */
  sizeGamma: number;
  /** System View orbit look (issue #2). */
  orbitStyle: OrbitStyle;
}

export const DEFAULT_SETTINGS: Settings = {
  moveSpeedLyPerS: 25,
  autoOrbit: true,
  realism: false,
  twinkleSpeed: 2 / 3,
  twinkleAmplitude: 0.5,
  sizeGamma: 1.2,
  orbitStyle: 'trail',
};

interface SettingsState extends Settings {
  setSettings: (update: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setSettings: (update) => set(update),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'galaxy-map-settings', version: 1 },
  ),
);

/** True when every setting equals its default (disables the reset button). */
export function isDefaultSettings(s: Settings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every(
    (k) => s[k] === DEFAULT_SETTINGS[k],
  );
}
