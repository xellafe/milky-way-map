import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../lib/format';
import { useCompactViewport } from '../lib/viewport';
import {
  TIME_SCALE_MAX_DAYS_PER_SECOND,
  TIME_SCALE_MIN_DAYS_PER_SECOND,
  useGalaxyMapStore,
} from '../state/store';
import { HudButton } from './hud/HudButton';
import { HudSlider, HudSwitch } from './hud/HudInputs';
import { HudCard } from './hud/HudCard';

const SLIDER_STEPS = 1000;
const LOG_MIN = Math.log10(TIME_SCALE_MIN_DAYS_PER_SECOND);
const LOG_MAX = Math.log10(TIME_SCALE_MAX_DAYS_PER_SECOND);

function toSlider(value: number, log: boolean): number {
  const v = Math.min(
    Math.max(value, TIME_SCALE_MIN_DAYS_PER_SECOND),
    TIME_SCALE_MAX_DAYS_PER_SECOND,
  );
  const f = log
    ? (Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)
    : (v - TIME_SCALE_MIN_DAYS_PER_SECOND) /
      (TIME_SCALE_MAX_DAYS_PER_SECOND - TIME_SCALE_MIN_DAYS_PER_SECOND);
  return Math.round(f * SLIDER_STEPS);
}

function fromSlider(slider: number, log: boolean): number {
  const f = slider / SLIDER_STEPS;
  return log
    ? 10 ** (LOG_MIN + f * (LOG_MAX - LOG_MIN))
    : TIME_SCALE_MIN_DAYS_PER_SECOND +
        f * (TIME_SCALE_MAX_DAYS_PER_SECOND - TIME_SCALE_MIN_DAYS_PER_SECOND);
}

/**
 * System View time-scale bar (SPEC §6.7): pause, slider, optional log mode.
 * Part of BottomStack, so it never overlaps the dock panel. The expanded
 * player takes the bar's band on compact viewports.
 */
export function TimeBar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const timeScale = useGalaxyMapStore((s) => s.timeScaleDaysPerSecond);
  const setTimeScale = useGalaxyMapStore((s) => s.setTimeScale);
  const musicExpanded = useGalaxyMapStore((s) => s.musicExpanded);
  const compact = useCompactViewport();
  const [logMode, setLogMode] = useState(false);
  const [pausedFrom, setPausedFrom] = useState<number | null>(null);
  const paused = timeScale === 0;

  if (musicExpanded && compact) return null;
  return (
    <HudCard
      as="section"
      aria-label={t('system.timeScale')}
      data-testid="time-scale"
      className="pointer-events-auto w-[28rem] max-w-[calc(100vw-2rem)] p-3 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span>{t('system.timeScale')}</span>
        <span className="font-hud-mono text-hud-bright" data-testid="time-scale-value">
          {t('system.daysPerSecond', {
            value: formatNumber(timeScale, lang, { maximumFractionDigits: 1 }),
          })}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <HudButton
          variant="secondary"
          data-testid="time-pause"
          onClick={() => {
            if (paused) {
              setTimeScale(pausedFrom ?? 2);
              setPausedFrom(null);
            } else {
              setPausedFrom(timeScale);
              setTimeScale(0);
            }
          }}
        >
          {paused ? '▶' : '⏸'}
          <span className="sr-only">{t(paused ? 'system.resume' : 'system.pause')}</span>
        </HudButton>
        <HudSlider
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={toSlider(paused ? (pausedFrom ?? 2) : timeScale, logMode)}
          disabled={paused}
          data-testid="time-slider"
          aria-label={t('system.timeScale')}
          onChange={(e) => setTimeScale(fromSlider(Number(e.target.value), logMode))}
          className="flex-1"
        />
        <HudSwitch
          // The wrapping label bakes in text-sm; a same-specificity text-xs in
          // className would conflict with it by stylesheet order, not intent, so
          // the smaller size is set on the label text itself instead.
          label={<span className="text-xs">{t('system.logScale')}</span>}
          checked={logMode}
          data-testid="time-log-mode"
          onChange={(e) => setLogMode(e.target.checked)}
          className="whitespace-nowrap"
        />
      </div>
    </HudCard>
  );
}
