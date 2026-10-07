import { useTranslation } from 'react-i18next';
import { getHost, type ExoplanetRecord } from '../data/exoplanets';
import { formatNumber } from '../lib/format';
import { formatLimited } from '../lib/limitedValue';
import { orbitSense } from '../lib/orbitSense';
import { planetComposition } from '../lib/planetComposition';
import { classifyPlanet } from '../lib/planetType';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';
import { HudCard } from './hud/HudCard';

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
  const advRows: [string, string, string][] = [
    [
      'adv-pl_dens',
      t('system.density'),
      formatLimited(planet.pl_dens, planet.pl_denslim, lang, 3, t('units.gcm3')) ?? na,
    ],
    [
      'adv-pl_insol',
      t('system.insolation'),
      formatLimited(planet.pl_insol, planet.pl_insollim, lang, 3, t('units.searth')) ?? na,
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
 * details (keyboard reachable, SPEC §6.9) and the real-scale disclaimer. The
 * time bar and the view controls live in BottomStack/DockPanel.
 */
export function SystemOverlay() {
  const { t } = useTranslation();
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const selectedPlanet = useGalaxyMapStore((s) => s.selectedPlanet);
  const selectPlanet = useGalaxyMapStore((s) => s.selectPlanet);
  const exitSystemView = useGalaxyMapStore((s) => s.exitSystemView);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);

  const host = hostname ? getHost(hostname) : null;
  if (!hostname || !host) return null;
  const shownPlanets = host.planets.filter((p) => visibleTypes[classifyPlanet(p)]);
  const planet = shownPlanets.find((p) => p.pl_name === selectedPlanet) ?? null;

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
      <HudCard
        as="aside"
        aria-label={t('system.planets')}
        className="absolute top-16 right-4 z-10 max-h-[calc(100%-13.5rem)] lg:max-h-[calc(100%-9.5rem)] w-80 overflow-y-auto p-4"
      >
        <p className="mb-2 text-sm text-hud-muted">{t('system.planets')}</p>
        <div className="flex flex-wrap gap-1">
          {shownPlanets.map((p) => (
            <button
              key={p.pl_name}
              type="button"
              data-testid="planet-chip"
              aria-pressed={selectedPlanet === p.pl_name}
              onClick={() => selectPlanet(selectedPlanet === p.pl_name ? null : p.pl_name)}
              className={`rounded-hud border px-2 py-1 font-hud text-xs ${
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
      </HudCard>
    </>
  );
}
