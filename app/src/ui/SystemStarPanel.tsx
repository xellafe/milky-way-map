import { useTranslation } from 'react-i18next';
import type { ExoHost } from '../data/exoplanets';
import { getStarCore } from '../data/starCoreStore';
import { formatNumber, spectralClassLetter } from '../lib/format';
import {
  LUMINOSITY_TICKS,
  STELLAR_RADIUS_TICKS,
  TEMPERATURE_TICKS,
  luminosityScale,
  stellarRadiusScale,
  temperatureScale,
} from '../lib/gaugeScale';
import { Badge } from './hud/Badge';
import { DataRow } from './hud/DataRow';
import { HudCard } from './hud/HudCard';
import { SIDE_PANEL_CLASS } from './sidePanel';
import { StatTile } from './hud/StatTile';
import { ArchiveSection, CatalogSection, StarExtraRows } from './StarDetails';
import { StarStatTiles } from './StarStatTiles';

/** Archive-only tiles for a host with no star-cloud counterpart: nothing is
 * derived from the cloud, and a missing value stays n/a (AGENTS rule 5). */
function UnanchoredTiles({ host }: { host: ExoHost }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  // The archive stores luminosity as log10(L/L☉).
  const lum = host.st_lum === null ? null : 10 ** host.st_lum;
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile
        testId="stat-teff"
        label={t('panel.teff')}
        value={formatNumber(host.st_teff, lang, { maximumSignificantDigits: 3 })}
        unit={t('units.kelvin')}
        variant="spectral"
        position={temperatureScale(host.st_teff)}
        ticks={TEMPERATURE_TICKS}
      />
      <StatTile
        testId="stat-luminosity"
        label={t('panel.luminosity')}
        value={formatNumber(lum, lang, { maximumSignificantDigits: 3 })}
        unit={t('units.lsun')}
        position={luminosityScale(lum)}
        ticks={LUMINOSITY_TICKS}
      />
      <StatTile
        testId="stat-stellar-radius"
        label={t('panel.stellarRadius')}
        value={formatNumber(host.st_rad, lang, { maximumSignificantDigits: 3 })}
        unit={t('units.rsun')}
        position={stellarRadiusScale(host.st_rad)}
        ticks={STELLAR_RADIUS_TICKS}
      />
    </div>
  );
}

/** Left panel of the System View: host-star data (SPEC §6.7). Anchored hosts
 * reuse the star card sections; unanchored ones show archive values only. */
export function SystemStarPanel({ hostname, host }: { hostname: string; host: ExoHost }) {
  const { t } = useTranslation();
  const index = host.starRef.matchedIndex;
  const anchored = index !== null;
  const cls = anchored ? spectralClassLetter(getStarCore()?.spectralClass[index] ?? 7) : null;
  return (
    <HudCard
      as="aside"
      data-hud="side-panel-left"
      data-testid="system-star-panel"
      aria-label={t('system.starPanel')}
      // Scrollable: needs keyboard access (axe scrollable-region-focusable).
      tabIndex={0}
      className={`${SIDE_PANEL_CLASS} left-4`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-hud text-base text-hud-bright">{hostname}</h2>
        {!host.starRef.matched && (
          <Badge tone="warn" data-testid="not-anchored-badge">
            {t('panel.notAnchored')}
          </Badge>
        )}
      </div>
      {cls && (
        <dl className="mb-2">
          <DataRow label={t('panel.spectralClass')} value={cls} />
        </dl>
      )}
      {anchored ? (
        <div className="flex flex-col gap-3">
          <StarStatTiles index={index} />
          <StarExtraRows index={index} />
          <CatalogSection index={index} />
        </div>
      ) : (
        <UnanchoredTiles host={host} />
      )}
      <div className="mt-3">
        <ArchiveSection host={host} />
      </div>
    </HudCard>
  );
}
