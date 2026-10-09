import { useTranslation } from 'react-i18next';
import type { ExoplanetRecord } from '../data/exoplanets';
import { formatNumber } from '../lib/format';
import { formatLimited } from '../lib/limitedValue';
import { orbitSense } from '../lib/orbitSense';
import { planetComposition } from '../lib/planetComposition';
import { classifyPlanet } from '../lib/planetType';
import { setSelectionAnchor } from '../scene/selectionAnchor';
import { useGalaxyMapStore } from '../state/store';
import { AnchoredCard } from './hud/AnchoredCard';
import { DataRow } from './hud/DataRow';
import { ObjectCard } from './hud/ObjectCard';
import { PlanetStatTiles } from './PlanetStatTiles';

function PlanetAdvanced({ planet }: { planet: ExoplanetRecord }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const num = (v: number | null, digits: number, unit = '') =>
    v !== null ? `${formatNumber(v, lang, { maximumSignificantDigits: digits })}${unit}` : null;
  const composition = planetComposition(
    planet.pl_bmasse,
    planet.pl_rade,
    planet.pl_bmassprov,
    planet.pl_bmasselim,
    planet.pl_radelim,
  );
  const sense = orbitSense(
    planet.pl_trueobliq,
    planet.pl_trueobliqlim,
    planet.pl_projobliq,
    planet.pl_projobliqlim,
  );

  return (
    <>
      <dl>
        <DataRow
          label={t('system.semiMajorAxis')}
          value={num(planet.pl_orbsmax, 4, ` ${t('units.au')}`)}
        />
        <DataRow label={t('system.eccentricity')} value={num(planet.pl_orbeccen, 3)} />
        <DataRow
          label={t('system.inclination')}
          value={planet.pl_orbincl !== null ? `${num(planet.pl_orbincl, 4)}°` : null}
        />
        <DataRow label={t('system.method')} value={planet.discoverymethod} />
        <DataRow
          label={t('system.discYear')}
          value={planet.disc_year !== null ? String(planet.disc_year) : null}
        />
        <DataRow
          testId="adv-pl_dens"
          label={t('system.density')}
          value={formatLimited(planet.pl_dens, planet.pl_denslim, lang, 3, t('units.gcm3'))}
        />
        <DataRow
          testId="adv-pl_insol"
          label={t('system.insolation')}
          value={formatLimited(planet.pl_insol, planet.pl_insollim, lang, 3, t('units.searth'))}
        />
        <DataRow
          testId="adv-mass-prov"
          label={t('system.massProvLabel')}
          value={
            planet.pl_bmassprov
              ? t(`system.massProv.${planet.pl_bmassprov}`, { defaultValue: planet.pl_bmassprov })
              : null
          }
        />
        <DataRow
          testId="adv-composition"
          label={t('system.compositionLabel')}
          value={composition ? t(`system.composition.${composition}`) : null}
        />
        <DataRow
          testId="adv-orbit-sense"
          label={t('system.orbitSenseLabel')}
          value={sense ? t(`system.orbitSense.${sense}`) : null}
        />
      </dl>

      {planet.pl_orbincl === null && (
        <p className="mt-1 text-xs text-hud-warn">{t('system.schematicOrbit')}</p>
      )}
      {composition && (
        <p className="mt-1 text-xs text-hud-muted" data-testid="adv-composition-note">
          {t('system.compositionNote')}
        </p>
      )}
    </>
  );
}

/** The single planet card (#23): Base/Advanced, anchored to the selected planet
 * (or alone beside the right panel when its orbit position is unknown). */
export function PlanetCard({ planet }: { planet: ExoplanetRecord }) {
  const { t } = useTranslation();
  const anchored = planet.pl_orbsmax !== null;
  return (
    <AnchoredCard
      anchorRef={setSelectionAnchor}
      anchored={anchored}
      card={
        <ObjectCard
          testId="planet-panel"
          titleTestId="planet-panel-title"
          closeTestId="planet-close"
          title={planet.pl_name}
          onClose={() => useGalaxyMapStore.getState().selectPlanet(null)}
          base={
            <>
              <PlanetStatTiles planet={planet} />
              <p className="text-xs text-hud-muted">
                {t('system.type')}:{' '}
                <span className="text-hud-bright">{t(`planetType.${classifyPlanet(planet)}`)}</span>
              </p>
              {!anchored && (
                <p className="text-xs text-hud-warn" data-testid="planet-no-position">
                  {t('system.noOrbitPosition')}
                </p>
              )}
            </>
          }
          advanced={<PlanetAdvanced planet={planet} />}
        />
      }
    />
  );
}
