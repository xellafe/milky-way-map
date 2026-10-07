import { useTranslation } from 'react-i18next';
import { getHost } from '../data/exoplanets';
import { ORBIT_STYLES, type OrbitStyle } from '../lib/planetStyle';
import { PLANET_TYPES } from '../lib/planetType';
import { useSettingsStore } from '../state/settings';
import { useGalaxyMapStore } from '../state/store';
import { HudSelect, HudSwitch } from './hud/HudInputs';

/**
 * System View "View" tab (SPEC §6.7): planet type filter, orbit style and the
 * habitable-zone toggle (disabled without stellar luminosity, never guessed).
 */
export function SystemViewPanel() {
  const { t } = useTranslation();
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const showHz = useGalaxyMapStore((s) => s.showHabitableZone);
  const toggleHz = useGalaxyMapStore((s) => s.toggleHabitableZone);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);
  const togglePlanetType = useGalaxyMapStore((s) => s.togglePlanetType);
  const orbitStyle = useSettingsStore((s) => s.orbitStyle);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const host = hostname ? getHost(hostname) : null;

  return (
    <section id="dock-panel-view" aria-label={t('view.title')} data-testid="system-view-panel">
      <fieldset className="mb-2" data-testid="planet-type-filter">
        <legend className="font-hud text-xs text-hud-muted">{t('system.planetTypes')}</legend>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {PLANET_TYPES.map((type) => (
            <HudSwitch
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
      <HudSwitch
        label={
          <>
            {t('system.habitableZone')}{' '}
            <span className="text-xs text-hud-warn">{t('system.hzApprox')}</span>
          </>
        }
        checked={showHz}
        disabled={!host || host.st_lum === null}
        data-testid="toggle-hz"
        onChange={toggleHz}
      />
    </section>
  );
}
