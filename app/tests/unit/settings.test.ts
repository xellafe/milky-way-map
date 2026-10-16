import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isDefaultSettings, useSettingsStore } from '../../src/state/settings';

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
