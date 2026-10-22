import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ORBIT_STYLES, type OrbitStyle } from '../lib/planetStyle';
import { STAR_COLOR_GAMMA } from '../lib/starColor';

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
  /** Ambient auto-orbit angular speed, degrees per second. */
  autoOrbitSpeedDegPerS: number;
  /** Realism: no hue exaggeration, no twinkle, no fireball core/corona. */
  realism: boolean;
  /** Time scale of the twinkle waves (1 = shader base frequencies). */
  twinkleSpeed: number;
  /** Twinkle brightness swing (0 = off). */
  twinkleAmplitude: number;
  /** Per-channel hue exponent (uColorGamma): 1 = catalog colors, 0 = white. */
  starColorSaturation: number;
  /** Star size contrast exponent (>1 widens the size range). */
  sizeGamma: number;
  /** System View orbit look (issue #2). */
  orbitStyle: OrbitStyle;
}

export const DEFAULT_SETTINGS: Settings = {
  moveSpeedLyPerS: 25,
  autoOrbit: true,
  autoOrbitSpeedDegPerS: 2, // human choice
  realism: false,
  twinkleSpeed: 2 / 3,
  twinkleAmplitude: 0.5,
  starColorSaturation: STAR_COLOR_GAMMA,
  sizeGamma: 1.2,
  orbitStyle: 'trail',
};

type NumericSettingKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

/**
 * Bounds of every numeric setting: read by the Options sliders and by the
 * rehydration validator, so UI and validation cannot drift. Ranges and steps
 * are an aesthetic choice (not data); units are those of `Settings`.
 */
export const SETTING_RANGES: Record<NumericSettingKey, { min: number; max: number; step: number }> =
  {
    moveSpeedLyPerS: { min: 5, max: 200, step: 5 },
    autoOrbitSpeedDegPerS: { min: 0.5, max: 10, step: 0.5 },
    twinkleSpeed: { min: 0.1, max: 2, step: 0.05 },
    twinkleAmplitude: { min: 0, max: 1, step: 0.05 },
    starColorSaturation: { min: 0, max: 4, step: 0.1 },
    sizeGamma: { min: 0.8, max: 1.6, step: 0.05 },
  };

const BOOLEAN_KEYS = ['autoOrbit', 'realism'] as const;

/**
 * Persisted state is untrusted input (#39): bad values would reach shader
 * uniforms. Finite out-of-range numbers are clamped (not step-snapped: the
 * default twinkleSpeed is off-grid); anything of the wrong type falls back to
 * the key's default; unknown keys are dropped. Silent by design.
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const src = raw as Record<string, unknown>;
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(SETTING_RANGES) as NumericSettingKey[]) {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      const { min, max } = SETTING_RANGES[key];
      out[key] = Math.min(max, Math.max(min, v));
    }
  }
  for (const key of BOOLEAN_KEYS) {
    const v = src[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  const style = src.orbitStyle;
  if (ORBIT_STYLES.includes(style as OrbitStyle)) out.orbitStyle = style as OrbitStyle;
  return out;
}

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
    {
      name: 'galaxy-map-settings',
      version: 1,
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
      // Older/unknown versions keep every still-valid key instead of being discarded.
      migrate: (persisted) => sanitizeSettings(persisted),
    },
  ),
);

/** True when every setting equals its default (disables the reset button). */
export function isDefaultSettings(s: Settings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every(
    (k) => s[k] === DEFAULT_SETTINGS[k],
  );
}
