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
    });
    expect(isDefaultSettings(useSettingsStore.getState())).toBe(true);
  });

  it('updates and resets', () => {
    useSettingsStore.getState().setSettings({ realism: true, moveSpeedLyPerS: 100 });
    const s = useSettingsStore.getState();
    expect(s.realism).toBe(true);
    expect(s.moveSpeedLyPerS).toBe(100);
    expect(isDefaultSettings(s)).toBe(false);
    s.resetSettings();
    expect(isDefaultSettings(useSettingsStore.getState())).toBe(true);
  });
});
