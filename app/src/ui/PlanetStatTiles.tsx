import { useTranslation } from 'react-i18next';
import type { ExoplanetRecord } from '../data/exoplanets';
import {
  EQ_TEMP_TICKS,
  PERIOD_TICKS,
  PLANET_MASS_TICKS,
  PLANET_RADIUS_TICKS,
  eqTempScale,
  orbitalPeriodScale,
  planetMassScale,
  planetRadiusScale,
} from '../lib/gaugeScale';
import { formatLimited } from '../lib/limitedValue';
import { StatTile } from './hud/StatTile';

/** Four headline stats of a planet (radius, mass, period, equilibrium
 * temperature), each with a gauge. */
export function PlanetStatTiles({ planet }: { planet: ExoplanetRecord }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const inHz = planet.in_hz;

  return (
    <div className="flex flex-col gap-1.5">
      <StatTile
        testId="stat-radius"
        compact
        label={t('system.radius')}
        value={formatLimited(planet.pl_rade, planet.pl_radelim, lang, 3)}
        unit={t('units.rearth')}
        position={planetRadiusScale(planet.pl_rade)}
        ticks={PLANET_RADIUS_TICKS}
      />
      <StatTile
        testId="stat-mass"
        compact
        label={t('system.mass')}
        value={formatLimited(planet.pl_bmasse, planet.pl_bmasselim, lang, 3)}
        unit={t('units.mearth')}
        position={planetMassScale(planet.pl_bmasse)}
        ticks={PLANET_MASS_TICKS}
      />
      <StatTile
        testId="stat-period"
        compact
        label={t('system.period')}
        value={formatLimited(planet.pl_orbper, null, lang, 5)}
        unit={t('units.days')}
        position={orbitalPeriodScale(planet.pl_orbper)}
        ticks={PERIOD_TICKS.map(({ labelKey, ...k }) => ({ ...k, label: t(labelKey) }))}
      />
      <StatTile
        testId="stat-eqt"
        compact
        label={t('system.eqTemp')}
        value={formatLimited(planet.pl_eqt, null, lang, 3)}
        unit={t('units.kelvin')}
        position={eqTempScale(planet.pl_eqt)}
        ticks={EQ_TEMP_TICKS}
        verdict={inHz === null ? undefined : t(inHz ? 'system.inHzYes' : 'system.inHzNo')}
      />
    </div>
  );
}
