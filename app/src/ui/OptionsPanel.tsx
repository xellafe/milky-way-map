import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../lib/format';
import { isDefaultSettings, type Settings, useSettingsStore } from '../state/settings';

type NumericKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

function SliderSetting({
  id,
  label,
  min,
  max,
  step,
  digits,
  suffix = '',
  disabled = false,
}: {
  id: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  digits: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const value = useSettingsStore((s) => s[id]);
  const setSettings = useSettingsStore((s) => s.setSettings);
  return (
    <label className={`mt-2 block ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex justify-between text-xs text-white/60">
        <span>{label}</span>
        <span>
          {formatNumber(value, i18n.language, { maximumFractionDigits: digits })}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-testid={`option-${id}`}
        className="w-full accent-white"
        onChange={(e) => setSettings({ [id]: Number(e.target.value) })}
      />
    </label>
  );
}

/** User customizations (issue #1): camera, star look. Persisted locally. */
export function OptionsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const settings = useSettingsStore();

  return (
    <div className="absolute top-4 right-[15rem] z-40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="options-panel"
        data-testid="options-toggle"
        className="rounded-lg bg-zinc-900/90 px-3 py-1.5 text-sm text-white shadow-xl backdrop-blur hover:bg-zinc-800/90"
      >
        <span aria-hidden>⚙ </span>
        {t('options.title')}
      </button>

      {open && (
        <section
          id="options-panel"
          aria-label={t('options.title')}
          data-testid="options-panel"
          className="absolute right-0 mt-1 max-h-[70vh] w-72 overflow-y-auto rounded-lg bg-zinc-900/95 p-3 text-sm text-white shadow-xl backdrop-blur"
        >
          <SliderSetting
            id="moveSpeedLyPerS"
            label={t('options.moveSpeed')}
            min={5}
            max={200}
            step={5}
            digits={0}
            suffix={` ${t('units.ly')}/s`}
          />
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.autoOrbit}
              data-testid="option-autoOrbit"
              onChange={(e) => settings.setSettings({ autoOrbit: e.target.checked })}
            />
            {t('options.autoOrbit')}
          </label>
          <label className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.realism}
              data-testid="option-realism"
              onChange={(e) => settings.setSettings({ realism: e.target.checked })}
            />
            {t('options.realism')}
          </label>
          <SliderSetting
            id="twinkleSpeed"
            label={t('options.twinkleSpeed')}
            min={0.1}
            max={2}
            step={0.05}
            digits={2}
            suffix="×"
            disabled={settings.realism}
          />
          <SliderSetting
            id="twinkleAmplitude"
            label={t('options.twinkleAmplitude')}
            min={0}
            max={1}
            step={0.05}
            digits={2}
            disabled={settings.realism}
          />
          <SliderSetting
            id="sizeGamma"
            label={t('options.sizeGamma')}
            min={0.8}
            max={1.6}
            step={0.05}
            digits={2}
          />
          <button
            type="button"
            onClick={settings.resetSettings}
            disabled={isDefaultSettings(settings)}
            data-testid="options-reset"
            className="mt-3 w-full rounded bg-white/10 px-3 py-1.5 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('options.reset')}
          </button>
        </section>
      )}
    </div>
  );
}
