import { describe, expect, it, vi } from 'vitest';

// Vitest runs without DOM: zustand `persist` is a no-op until a storage exists.
vi.hoisted(() => {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('window', { localStorage });
});
import {
  DEFAULT_SETTINGS,
  SETTING_RANGES,
  isDefaultSettings,
  sanitizeSettings,
  useSettingsStore,
  type Settings,
} from '../../src/state/settings';

describe('settings store', () => {
  it('defaults match the previous hard-coded tuning', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      moveSpeedLyPerS: 25,
      autoOrbit: true,
      realism: false,
      twinkleSpeed: 2 / 3,
      twinkleAmplitude: 0.5,
      sizeGamma: 1.2,
      orbitStyle: 'trail',
      autoOrbitSpeedDegPerS: 2,
      starColorSaturation: 2.5,
    });
    expect(isDefaultSettings(useSettingsStore.getState())).toBe(true);
  });

  it('updates and resets', () => {
    useSettingsStore.getState().setSettings({
      realism: true,
      moveSpeedLyPerS: 100,
      autoOrbitSpeedDegPerS: 5,
      starColorSaturation: 3.5,
    });
    const s = useSettingsStore.getState();
    expect(s.realism).toBe(true);
    expect(s.moveSpeedLyPerS).toBe(100);
    expect(s.autoOrbitSpeedDegPerS).toBe(5);
    expect(s.starColorSaturation).toBe(3.5);
    expect(isDefaultSettings(s)).toBe(false);
    s.resetSettings();
    expect(isDefaultSettings(useSettingsStore.getState())).toBe(true);
    expect(useSettingsStore.getState().autoOrbitSpeedDegPerS).toBe(2);
    expect(useSettingsStore.getState().starColorSaturation).toBe(2.5);
  });
});

const NUMERIC_KEYS = Object.keys(SETTING_RANGES) as (keyof typeof SETTING_RANGES)[];

describe('sanitizeSettings', () => {
  it('non-object payload -> defaults', () => {
    for (const raw of [null, undefined, [], [1, 2], 'x', 42, true]) {
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('clamps out-of-range numbers', () => {
    for (const key of NUMERIC_KEYS) {
      const { min, max } = SETTING_RANGES[key];
      expect(sanitizeSettings({ [key]: max + 1000 })[key]).toBe(max);
      expect(sanitizeSettings({ [key]: min - 1000 })[key]).toBe(min);
    }
    expect(sanitizeSettings({ twinkleSpeed: 2 / 3 }).twinkleSpeed).toBe(2 / 3);
    expect(sanitizeSettings({ moveSpeedLyPerS: 42 }).moveSpeedLyPerS).toBe(42);
  });

  it('wrong type -> per-key default', () => {
    for (const key of NUMERIC_KEYS) {
      for (const bad of [NaN, Infinity, -Infinity, 'x', '5', null]) {
        expect(sanitizeSettings({ [key]: bad })[key]).toBe(DEFAULT_SETTINGS[key]);
      }
    }
    const out = sanitizeSettings({
      autoOrbit: 'yes',
      realism: 1,
      orbitStyle: 'bogus',
      moveSpeedLyPerS: 100,
    });
    expect(out.autoOrbit).toBe(DEFAULT_SETTINGS.autoOrbit);
    expect(out.realism).toBe(DEFAULT_SETTINGS.realism);
    expect(out.orbitStyle).toBe(DEFAULT_SETTINGS.orbitStyle);
    expect(out.moveSpeedLyPerS).toBe(100);
    expect(sanitizeSettings({ autoOrbit: false, orbitStyle: 'thick' })).toMatchObject({
      autoOrbit: false,
      orbitStyle: 'thick',
    });
  });

  it('fills missing, drops unknown keys', () => {
    const out = sanitizeSettings({ sizeGamma: 1.4, extra: 1 });
    expect(out.sizeGamma).toBe(1.4);
    expect(out).toEqual({ ...DEFAULT_SETTINGS, sizeGamma: 1.4 });
    expect('extra' in out).toBe(false);
  });

  it('ranges match slider bounds', () => {
    expect(SETTING_RANGES).toEqual({
      moveSpeedLyPerS: { min: 5, max: 200, step: 5 },
      autoOrbitSpeedDegPerS: { min: 0.5, max: 10, step: 0.5 },
      twinkleSpeed: { min: 0.1, max: 2, step: 0.05 },
      twinkleAmplitude: { min: 0, max: 1, step: 0.05 },
      starColorSaturation: { min: 0, max: 4, step: 0.1 },
      sizeGamma: { min: 0.8, max: 1.6, step: 0.05 },
    });
  });
});

describe('settings persistence', () => {
  const options = () => useSettingsStore.persist.getOptions();

  it('merge sanitizes rehydrated state', () => {
    const current = useSettingsStore.getState();
    const merged = options().merge!(
      { moveSpeedLyPerS: 1000, twinkleSpeed: 'x', orbitStyle: 'bogus', realism: true },
      current,
    ) as Settings & { setSettings: unknown };
    expect(merged.moveSpeedLyPerS).toBe(200);
    expect(merged.twinkleSpeed).toBe(DEFAULT_SETTINGS.twinkleSpeed);
    expect(merged.orbitStyle).toBe(DEFAULT_SETTINGS.orbitStyle);
    expect(merged.realism).toBe(true);
    expect(merged.setSettings).toBe(current.setSettings);
  });

  it('migrate keeps valid keys', () => {
    const migrated = options().migrate!({ realism: true, sizeGamma: 9, autoOrbit: 'no' }, 0);
    expect(migrated).toEqual({ ...DEFAULT_SETTINGS, realism: true, sizeGamma: 1.6 });
  });
});
