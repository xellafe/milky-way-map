import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHost, isExoplanetsReady, loadExoplanets, type ExoHost } from '../data/exoplanets';
import { getNamesEntry } from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
import { getStarDetails } from '../data/starDetailsStore';
import {
  FLAG_HAS_EXOPLANETS,
  FLAG_MULTIPLE,
  FLAG_VARIABLE,
  formatNumber,
  hasFlag,
  spectralClassLetter,
} from '../lib/format';
import { formatLimited, metallicityRatioTag } from '../lib/limitedValue';
import { useGalaxyMapStore } from '../state/store';
import { Badge } from './hud/Badge';
import { CloseButton } from './hud/CloseButton';
import { DataRow } from './hud/DataRow';
import { HudButton } from './hud/HudButton';
import { HudCard } from './hud/HudCard';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** Collapsed host-star data from the NASA Exoplanet Archive (#18); absent fields read n/a. */
function AdvancedStarData({ host }: { host: ExoHost }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const tag = metallicityRatioTag(host.st_metratio);
  return (
    <details className="mt-2 text-sm" data-testid="star-advanced">
      <summary className="cursor-pointer py-1 text-hud-muted hover:text-hud-bright">
        {t('panel.advancedData')}
      </summary>
      <dl>
        <DataRow
          label={tag ? `${t('panel.advMetallicity')} ${tag}` : t('panel.advMetallicity')}
          value={formatLimited(host.st_met, host.st_metlim, lang, 3, t('units.dex'))}
          testId="adv-st_met"
        />
        <DataRow
          label={t('panel.advAge')}
          value={formatLimited(host.st_age, host.st_agelim, lang, 3, t('units.gyr'))}
          testId="adv-st_age"
        />
        <DataRow
          label={t('panel.advMass')}
          value={formatLimited(host.st_mass, host.st_masslim, lang, 3, t('units.msun'))}
          testId="adv-st_mass"
        />
        <DataRow
          label={t('panel.advLogg')}
          value={formatLimited(host.st_logg, host.st_logglim, lang, 3, t('units.cgs'))}
          testId="adv-st_logg"
        />
        <DataRow label={t('panel.advSpectype')} value={host.st_spectype} testId="adv-st_spectype" />
        <DataRow
          label={t('panel.advRotation')}
          value={formatLimited(host.st_rotp, host.st_rotplim, lang, 3, t('units.days'))}
          testId="adv-st_rotp"
        />
        <DataRow
          label={t('panel.advVsini')}
          value={formatLimited(host.st_vsin, host.st_vsinlim, lang, 3, t('units.kms'))}
          testId="adv-st_vsin"
        />
      </dl>
    </details>
  );
}

/** Star details (SPEC §6.6) for a star of the cloud, by SoA index.
 * Core data comes from starCoreStore, not props (see store docs). */
function StarDetails({ index }: { index: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const core = getStarCore();
  const flags = core?.flags[index] ?? 0;
  const hasExo = hasFlag(flags, FLAG_HAS_EXOPLANETS);
  const details = getStarDetails();
  const entry = getNamesEntry(index);
  const { hostname, host } = useStarHost(index);

  const { title, catalogIds } = useStarTitle(index);
  const age = host?.st_age ?? null;

  const ids: string[] = [];
  if (entry?.hd) ids.push(`HD ${entry.hd}`);
  if (entry?.hip) ids.push(`HIP ${entry.hip}`);
  if (entry?.gl) ids.push(entry.gl);
  if (catalogIds?.tyc) ids.push(`TYC ${catalogIds.tyc}`);
  if (catalogIds?.gaia) ids.push(`Gaia DR3 ${catalogIds.gaia}`);

  const bv = details ? details.colorIndex[index]! : Number.NaN;
  const spectral = spectralClassLetter(core?.spectralClass[index] ?? 7);

  return (
    <>
      <h2 className="mb-1 font-hud text-lg text-hud-bright" data-testid="panel-title">
        {title}
      </h2>
      <p className="mb-3 flex items-center gap-2 text-sm text-hud-muted">
        {entry?.constellation && (
          <span>
            {t('panel.constellation')}: {entry.constellation}
          </span>
        )}
        <span className="sr-only">{t('panel.spectralClass')}</span>
        <Badge>{spectral ?? t('panel.na')}</Badge>
      </p>
      <StarStatTiles index={index} />
      <dl className="mt-3 text-sm">
        <DataRow
          label={t('panel.absoluteMagnitude')}
          value={
            details ? formatNumber(details.absMag[index], lang, { maximumFractionDigits: 2 }) : null
          }
        />
        <DataRow
          label={t('panel.colorIndex')}
          value={details ? formatNumber(bv, lang, { maximumFractionDigits: 3 }) : null}
        />
        {/* Age is not in HYG/AT-HYG (SPEC §6.6: never fabricated); only an exoplanet host
            can carry the archive value. */}
        <DataRow
          label={t('panel.age')}
          value={formatLimited(age, host?.st_agelim ?? null, lang, 3, t('units.gyr'))}
          note={t('panel.ageNote')}
          warnNote
          testId="star-age"
        />
      </dl>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer py-1 text-hud-muted hover:text-hud-bright">
          {t('panel.moreData')}
        </summary>
        <dl>
          <DataRow label={t('panel.catalogIds')} value={ids.length > 0 ? ids.join(' · ') : null} />
          {/* Luminosity class is not in the data contract (SPEC §5.1) → n/d, never guessed. */}
          <DataRow label={t('panel.msClass')} value={null} />
          <DataRow
            label={t('panel.variable')}
            value={t(hasFlag(flags, FLAG_VARIABLE) ? 'panel.yes' : 'panel.no')}
          />
          <DataRow
            label={t('panel.multiple')}
            value={t(hasFlag(flags, FLAG_MULTIPLE) ? 'panel.yes' : 'panel.no')}
          />
        </dl>
      </details>
      {host && <AdvancedStarData host={host} />}
      {hasExo && (
        <div className="mt-3">
          {host && (
            <p className="mb-2">
              <Badge data-testid="planets-badge">
                {t('panel.planetsCount', { count: host.planets.length })}
              </Badge>
            </p>
          )}
          <HudButton
            variant="secondary"
            // Enabled once the exoplanets data resolved this star to its host.
            disabled={!hostname}
            onClick={() => {
              if (hostname) useGalaxyMapStore.getState().enterSystemView(hostname);
            }}
            className="w-full"
            data-testid="view-system-button"
          >
            {t('panel.viewSystem')}
            {hostname ? ` — ${hostname}` : ''}
          </HudButton>
        </div>
      )}
    </>
  );
}

/** Panel for an exoplanet host NOT anchored to a catalog star (SPEC §5.3/§10). */
function HostDetails({ hostname }: { hostname: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!isExoplanetsReady()) {
      loadExoplanets()
        .then(() => forceRender((n) => n + 1))
        .catch(() => {});
    }
  }, [hostname]);

  const host = getHost(hostname);
  if (!host) return <p className="text-sm text-hud-muted">{t('ui.loading')}</p>;

  const lumLinear = host.st_lum !== null ? 10 ** host.st_lum : null;

  return (
    <>
      <h2 className="mb-1 font-hud text-lg text-hud-bright" data-testid="panel-title">
        {hostname}
      </h2>
      <p className="mb-2" data-testid="not-anchored-badge">
        <Badge tone="warn">{t('panel.notAnchored')}</Badge>
      </p>
      <p className="mb-1 text-sm text-hud-muted">{t('panel.hostStar')}</p>
      <dl className="text-sm">
        <DataRow
          label={t('panel.stTeff')}
          value={
            host.st_teff !== null
              ? `${formatNumber(host.st_teff, lang)} ${t('units.kelvin')}`
              : null
          }
        />
        <DataRow
          label={t('panel.stLum')}
          value={formatNumber(lumLinear, lang, { maximumSignificantDigits: 3 })}
          note={t('units.lsun')}
        />
        <DataRow
          label={t('panel.stRad')}
          value={formatNumber(host.st_rad, lang, { maximumFractionDigits: 2 })}
          note={t('units.rsun')}
        />
        <DataRow
          label={t('panel.exoplanets')}
          value={t('panel.planetsCount', { count: host.planets.length })}
        />
      </dl>
      <AdvancedStarData host={host} />
      <ul className="mt-2 text-sm text-hud-text" data-testid="planet-list">
        {host.planets.map((p) => (
          <li key={p.pl_name} className="border-b border-hud-accent/20 py-1">
            {p.pl_name}
          </li>
        ))}
      </ul>
      <HudButton
        variant="secondary"
        onClick={() => useGalaxyMapStore.getState().enterSystemView(hostname)}
        className="mt-3 w-full"
        data-testid="view-system-button"
      >
        {t('panel.viewSystem')}
      </HudButton>
    </>
  );
}

/** Details panel (SPEC §6.6) — DOM overlay, keyboard reachable, ARIA region. */
export function StarPanel() {
  const { t } = useTranslation();
  const selection = useGalaxyMapStore((s) => s.selection);
  const selectStar = useGalaxyMapStore((s) => s.selectStar);

  if (!selection) return null;

  return (
    // max-h ends 1rem above the expanded music player (aesthetic choice, not data;
    // rem). Panel top is 4rem; the player is 3.5rem tall (measured). Below lg it sits
    // at bottom-20: 4 + 5 + 3.5 + 1 = 13.5rem. From lg at bottom-4: 4 + 1 + 3.5 + 1 = 9.5rem.
    <HudCard
      as="aside"
      role="region"
      aria-label={t('panel.regionLabel')}
      data-testid="star-panel"
      data-hud="star-panel"
      className="absolute top-16 right-4 z-10 max-h-[calc(100%-13.5rem)] lg:max-h-[calc(100%-9.5rem)] w-80 overflow-y-auto p-4"
    >
      <CloseButton
        onClick={() => selectStar(null)}
        label={t('panel.close')}
        testId="panel-close"
        hud="panel-close"
      />
      {selection.kind === 'star' ? (
        <StarDetails index={selection.index} />
      ) : selection.kind === 'host' ? (
        <HostDetails hostname={selection.hostname} />
      ) : null}
    </HudCard>
  );
}
