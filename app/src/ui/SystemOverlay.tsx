import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHost, type ExoplanetRecord } from '../data/exoplanets';
import { formatNumber } from '../lib/format';
import { limitPrefix, type Lim } from '../lib/limitedValue';
import { orbitSense } from '../lib/orbitSense';
import { planetComposition } from '../lib/planetComposition';
import { useCompactViewport } from '../lib/viewport';
import { ORBIT_STYLES, type OrbitStyle } from '../lib/planetStyle';
import { classifyPlanet, PLANET_TYPES } from '../lib/planetType';
import { useSettingsStore } from '../state/settings';
import {
  TIME_SCALE_MAX_DAYS_PER_SECOND,
  TIME_SCALE_MIN_DAYS_PER_SECOND,
  useGalaxyMapStore,
} from '../state/store';
import { HudButton } from './hud/HudButton';
import { HudCheckbox, HudSelect, HudSlider } from './hud/HudInputs';
import { HudPanel } from './hud/HudPanel';

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

function PlanetDetails({ planet }: { planet: ExoplanetRecord }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const na = t('panel.na');
  const num = (v: number | null, digits = 3, unit = '') =>
    v !== null ? `${formatNumber(v, lang, { maximumSignificantDigits: digits })}${unit}` : na;

  const rows: [string, string][] = [
    [t('system.period'), num(planet.pl_orbper, 5, ` ${t('units.days')}`)],
    [t('system.semiMajorAxis'), num(planet.pl_orbsmax, 4, ` ${t('units.au')}`)],
    [t('system.type'), t(`planetType.${classifyPlanet(planet)}`)],
    [t('system.radius'), num(planet.pl_rade, 3, ` ${t('units.rearth')}`)],
    [t('system.mass'), num(planet.pl_bmasse, 3, ` ${t('units.mearth')}`)],
    [t('system.eccentricity'), num(planet.pl_orbeccen, 3)],
    [t('system.inclination'), planet.pl_orbincl !== null ? `${num(planet.pl_orbincl, 4)}°` : na],
    [t('system.method'), planet.discoverymethod ?? na],
    [t('system.discYear'), planet.disc_year !== null ? String(planet.disc_year) : na],
    [t('system.eqTemp'), num(planet.pl_eqt, 4, ` ${t('units.kelvin')}`)],
    [t('system.inHz'), planet.in_hz === null ? na : t(planet.in_hz ? 'panel.yes' : 'panel.no')],
  ];

  const limNum = (v: number | null, lim: Lim, unit: string) =>
    v !== null ? `${limitPrefix(lim)}${num(v, 3, ` ${unit}`)}` : na;
  const composition = planetComposition(planet.pl_bmasse, planet.pl_rade, planet.pl_bmassprov);
  const sense = orbitSense(
    planet.pl_trueobliq,
    planet.pl_trueobliqlim,
    planet.pl_projobliq,
    planet.pl_projobliqlim,
  );
  const advRows: [string, string, string][] = [
    [
      'adv-pl_dens',
      t('system.density'),
      limNum(planet.pl_dens, planet.pl_denslim, t('units.gcm3')),
    ],
    [
      'adv-pl_insol',
      t('system.insolation'),
      limNum(planet.pl_insol, planet.pl_insollim, t('units.searth')),
    ],
    [
      'adv-mass-prov',
      t('system.massProvLabel'),
      planet.pl_bmassprov
        ? t(`system.massProv.${planet.pl_bmassprov}`, { defaultValue: planet.pl_bmassprov })
        : na,
    ],
    [
      'adv-composition',
      t('system.compositionLabel'),
      composition ? t(`system.composition.${composition}`) : na,
    ],
    ['adv-orbit-sense', t('system.orbitSenseLabel'), sense ? t(`system.orbitSense.${sense}`) : na],
  ];

  return (
    <div className="mt-2 border-t border-hud-accent/20 pt-2" data-testid="planet-panel">
      <h3 className="mb-1 font-hud text-hud-bright" data-testid="planet-panel-title">
        {planet.pl_name}
      </h3>
      {planet.pl_orbincl === null && (
        <p className="mb-1 text-xs text-hud-warn">{t('system.schematicOrbit')}</p>
      )}
      <dl className="text-sm">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 border-b border-hud-accent/20 py-1"
          >
            <dt className="text-hud-muted">{label}</dt>
            <dd className="text-right font-hud-mono text-hud-bright">{value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2 text-sm" data-testid="planet-advanced">
        <summary className="cursor-pointer py-1 text-hud-muted hover:text-hud-bright">
          {t('system.advancedData')}
        </summary>
        <dl>
          {advRows.map(([id, label, value]) => (
            <div
              key={id}
              className="flex justify-between gap-3 border-b border-hud-accent/20 py-1"
              data-testid={id}
            >
              <dt className="text-hud-muted">{label}</dt>
              <dd className="text-right font-hud-mono text-hud-bright">{value}</dd>
            </div>
          ))}
        </dl>
        {composition && (
          <p className="mt-1 text-xs text-hud-muted" data-testid="adv-composition-note">
            {t('system.compositionNote')}
          </p>
        )}
      </details>
    </div>
  );
}

/**
 * DOM overlay of the System View (SPEC §6.7): back to galaxy, planet list +
 * details (keyboard reachable, SPEC §6.9), shared time-scale slider with
 * optional log mode, HZ toggle (disabled without stellar luminosity, never
 * guessed), and the real-scale disclaimer.
 */
export function SystemOverlay() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const selectedPlanet = useGalaxyMapStore((s) => s.selectedPlanet);
  const selectPlanet = useGalaxyMapStore((s) => s.selectPlanet);
  const exitSystemView = useGalaxyMapStore((s) => s.exitSystemView);
  const timeScale = useGalaxyMapStore((s) => s.timeScaleDaysPerSecond);
  const setTimeScale = useGalaxyMapStore((s) => s.setTimeScale);
  const showHz = useGalaxyMapStore((s) => s.showHabitableZone);
  const toggleHz = useGalaxyMapStore((s) => s.toggleHabitableZone);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);
  const togglePlanetType = useGalaxyMapStore((s) => s.togglePlanetType);
  const orbitStyle = useSettingsStore((s) => s.orbitStyle);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const dockPanel = useGalaxyMapStore((s) => s.dockPanel);
  const musicExpanded = useGalaxyMapStore((s) => s.musicExpanded);
  const compact = useCompactViewport();
  const [logMode, setLogMode] = useState(false);
  const [pausedFrom, setPausedFrom] = useState<number | null>(null);

  const host = hostname ? getHost(hostname) : null;
  if (!hostname || !host) return null;
  const shownPlanets = host.planets.filter((p) => visibleTypes[classifyPlanet(p)]);
  const planet = shownPlanets.find((p) => p.pl_name === selectedPlanet) ?? null;
  const paused = timeScale === 0;

  return (
    <>
      <header className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <HudButton variant="secondary" onClick={exitSystemView} data-testid="system-back">
          ← {t('system.back')}
        </HudButton>
        <h1 className="font-hud text-lg text-hud-bright" data-testid="system-title">
          {hostname}
        </h1>
      </header>

      {/*
       * Right panels end 1rem above the expanded music player: max-h is an
       * aesthetic choice (not data), in rem. Panel top is 4rem; the player is
       * 3.5rem tall (measured). Below lg it sits at bottom-20: 4 + 5 + 3.5 + 1 =
       * 13.5rem. From lg at bottom-4: 4 + 1 + 3.5 + 1 = 9.5rem.
       */}
      <aside
        aria-label={t('system.planets')}
        className="hud-panel absolute top-16 right-4 z-10 max-h-[calc(100%-13.5rem)] lg:max-h-[calc(100%-9.5rem)] w-80 overflow-y-auto rounded-hud p-4"
      >
        <p className="mb-2 text-sm text-hud-muted">{t('system.planets')}</p>
        <fieldset className="mb-2" data-testid="planet-type-filter">
          <legend className="font-hud text-xs text-hud-muted">{t('system.planetTypes')}</legend>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {PLANET_TYPES.map((type) => (
              <HudCheckbox
                key={type}
                label={t(`planetType.${type}`)}
                checked={visibleTypes[type]}
                data-testid={`planet-type-${type}`}
                onChange={() => togglePlanetType(type)}
              />
            ))}
          </div>
        </fieldset>
        <label className="mb-2 flex items-center justify-between gap-2 font-hud text-xs text-hud-muted">
          {t('system.orbitStyle')}
          <HudSelect
            value={orbitStyle}
            data-testid="orbit-style"
            onChange={(e) => setSettings({ orbitStyle: e.target.value as OrbitStyle })}
          >
            {ORBIT_STYLES.map((style) => (
              <option key={style} value={style}>
                {t(`orbitStyle.${style}`)}
              </option>
            ))}
          </HudSelect>
        </label>
        <div className="flex flex-wrap gap-1">
          {shownPlanets.map((p) => (
            <button
              key={p.pl_name}
              type="button"
              data-testid="planet-chip"
              aria-pressed={selectedPlanet === p.pl_name}
              onClick={() => selectPlanet(selectedPlanet === p.pl_name ? null : p.pl_name)}
              className={`rounded border px-2 py-1 font-hud text-xs ${
                selectedPlanet === p.pl_name
                  ? 'border-hud-accent/60 bg-hud-accent/20 text-hud-bright'
                  : 'border-hud-accent/30 bg-white/5 text-hud-text hover:bg-white/10'
              }`}
            >
              {p.pl_name}
            </button>
          ))}
        </div>
        {planet && <PlanetDetails planet={planet} />}
        <p className="mt-3 text-xs text-hud-muted">{t('system.scaleNote')}</p>
      </aside>

      {/*
       * Sits above the dock (#3: the dock shows only Options in the
       * System View). The dock icon row is at bottom-4; bottom-20 clears it.
       * An open dock panel renders in that same band (Dock.tsx) and its
       * height varies (Options is tall), so the bar is hidden while a panel
       * is open instead of guessing an offset that can still overlap. The
       * expanded player takes the bar's band on compact viewports.
       */}
      {!dockPanel && !(musicExpanded && compact) && (
        <HudPanel
          aria-label={t('system.timeScale')}
          className="absolute bottom-20 left-1/2 z-10 w-[28rem] max-w-[calc(100%-2rem)] -translate-x-1/2 text-sm"
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
            <HudCheckbox
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
          <div className="mt-2 flex items-center gap-2">
            <HudCheckbox
              label={
                <>
                  {t('system.habitableZone')}{' '}
                  <span className="text-xs text-hud-warn">{t('system.hzApprox')}</span>
                </>
              }
              checked={showHz}
              disabled={host.st_lum === null}
              data-testid="toggle-hz"
              onChange={toggleHz}
            />
          </div>
        </HudPanel>
      )}
    </>
  );
}
