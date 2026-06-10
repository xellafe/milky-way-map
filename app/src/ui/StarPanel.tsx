import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchCatalogIds, type CatalogIds } from '../data/catalogIds';
import {
  getHost,
  getHostnameByStarIndex,
  isExoplanetsReady,
  loadExoplanets,
  type ExoHost,
} from '../data/exoplanets';
import { entryLabel, getNamesEntry } from '../data/namesIndex';
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
import { estimateTeffFromBV } from '../lib/teff';
import { useGalaxyMapStore } from '../state/store';

function Row({ label, value, note }: { label: string; value: string | null; note?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 py-1.5">
      <dt className="text-white/60">{label}</dt>
      <dd className="text-right text-white">
        {value ?? t('panel.na')}
        {note && value !== null && <span className="ml-1 text-xs text-white/50">{note}</span>}
      </dd>
    </div>
  );
}

/** Star details (SPEC §6.6) for a star of the cloud, by SoA index.
 * Core data comes from starCoreStore, not props (see store docs). */
function StarDetails({ index }: { index: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  // Async lookups are keyed by star index: stale results for a previously
  // selected star are simply ignored at render (no sync setState in effects).
  const [idsResult, setIdsResult] = useState<{ index: number; ids: CatalogIds } | null>(null);
  const [hostResult, setHostResult] = useState<{
    index: number;
    hostname: string | null;
    host: ExoHost | null;
  } | null>(null);

  const core = getStarCore();
  const flags = core?.flags[index] ?? 0;
  const hasExo = hasFlag(flags, FLAG_HAS_EXOPLANETS);
  const details = getStarDetails();
  const entry = getNamesEntry(index);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogIds(index)
      .then((ids) => {
        if (!cancelled) setIdsResult({ index, ids });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [index]);

  useEffect(() => {
    if (!hasExo) return;
    let cancelled = false;
    loadExoplanets()
      .then(() => {
        if (cancelled) return;
        const name = getHostnameByStarIndex(index);
        setHostResult({ index, hostname: name, host: name ? getHost(name) : null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [index, hasExo]);

  const catalogIds = idsResult?.index === index ? idsResult.ids : null;
  const host = hostResult?.index === index ? hostResult.host : null;
  const hostname = hostResult?.index === index ? hostResult.hostname : null;

  const title =
    (entry && entryLabel(entry)) ||
    (catalogIds?.tyc && `TYC ${catalogIds.tyc}`) ||
    (catalogIds?.gaia && `Gaia DR3 ${catalogIds.gaia}`) ||
    `#${index}`;

  const ids: string[] = [];
  if (entry?.hd) ids.push(`HD ${entry.hd}`);
  if (entry?.hip) ids.push(`HIP ${entry.hip}`);
  if (entry?.gl) ids.push(entry.gl);
  if (catalogIds?.tyc) ids.push(`TYC ${catalogIds.tyc}`);
  if (catalogIds?.gaia) ids.push(`Gaia DR3 ${catalogIds.gaia}`);

  const bv = details ? details.colorIndex[index]! : Number.NaN;
  const teff = estimateTeffFromBV(bv);
  const distance = details
    ? formatNumber(details.distanceLy[index], lang, { maximumFractionDigits: 1 })
    : null;

  return (
    <>
      <h2 className="mb-1 text-lg font-semibold text-white" data-testid="panel-title">
        {title}
      </h2>
      {entry?.constellation && (
        <p className="mb-2 text-sm text-white/60">
          {t('panel.constellation')}: {entry.constellation}
        </p>
      )}
      <dl className="text-sm">
        <Row label={t('panel.catalogIds')} value={ids.length > 0 ? ids.join(' · ') : null} />
        <Row
          label={t('panel.spectralClass')}
          value={spectralClassLetter(core?.spectralClass[index] ?? 7)}
        />
        {/* Luminosity class is not in the data contract (SPEC §5.1) → n/d, never guessed. */}
        <Row label={t('panel.msClass')} value={null} />
        <Row
          label={t('panel.distance')}
          value={distance !== null ? `${distance} ${t('units.ly')}` : null}
        />
        <Row
          label={t('panel.apparentMagnitude')}
          value={
            details ? formatNumber(details.appMag[index], lang, { maximumFractionDigits: 2 }) : null
          }
        />
        <Row
          label={t('panel.absoluteMagnitude')}
          value={
            details ? formatNumber(details.absMag[index], lang, { maximumFractionDigits: 2 }) : null
          }
        />
        <Row
          label={t('panel.colorIndex')}
          value={details ? formatNumber(bv, lang, { maximumFractionDigits: 3 }) : null}
        />
        <Row
          label={t('panel.luminosity')}
          value={
            details
              ? formatNumber(details.luminosity[index], lang, { maximumSignificantDigits: 3 })
              : null
          }
          note={t('units.lsun')}
        />
        <Row
          label={t('panel.teff')}
          value={
            teff !== null ? `≈ ${formatNumber(Math.round(teff), lang)} ${t('units.kelvin')}` : null
          }
          note={t('panel.estimateSuffix')}
        />
        {/* Age is not present in HYG/AT-HYG → always n/d in v1 (SPEC §6.6: never fabricated). */}
        <Row label={t('panel.age')} value={null} note={t('panel.ageNote')} />
        <Row
          label={t('panel.variable')}
          value={t(hasFlag(flags, FLAG_VARIABLE) ? 'panel.yes' : 'panel.no')}
        />
        <Row
          label={t('panel.multiple')}
          value={t(hasFlag(flags, FLAG_MULTIPLE) ? 'panel.yes' : 'panel.no')}
        />
        <Row
          label={t('panel.exoplanets')}
          value={
            hasExo
              ? host
                ? t('panel.planetsCount', { count: host.planets.length })
                : t('panel.yes')
              : t('panel.no')
          }
        />
      </dl>
      {hasExo && (
        <button
          type="button"
          // Enabled once the exoplanets data resolved this star to its host.
          disabled={!hostname}
          onClick={() => {
            if (hostname) useGalaxyMapStore.getState().enterSystemView(hostname);
          }}
          className="mt-3 w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:text-white/50"
          data-testid="view-system-button"
        >
          {t('panel.viewSystem')}
          {hostname ? ` — ${hostname}` : ''}
        </button>
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
  if (!host) return <p className="text-sm text-white/60">{t('ui.loading')}</p>;

  const lumLinear = host.st_lum !== null ? 10 ** host.st_lum : null;

  return (
    <>
      <h2 className="mb-1 text-lg font-semibold text-white" data-testid="panel-title">
        {hostname}
      </h2>
      <p
        className="mb-2 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-300"
        data-testid="not-anchored-badge"
      >
        {t('panel.notAnchored')}
      </p>
      <p className="mb-1 text-sm text-white/60">{t('panel.hostStar')}</p>
      <dl className="text-sm">
        <Row
          label={t('panel.stTeff')}
          value={
            host.st_teff !== null
              ? `${formatNumber(host.st_teff, lang)} ${t('units.kelvin')}`
              : null
          }
        />
        <Row
          label={t('panel.stLum')}
          value={formatNumber(lumLinear, lang, { maximumSignificantDigits: 3 })}
          note={t('units.lsun')}
        />
        <Row
          label={t('panel.stRad')}
          value={formatNumber(host.st_rad, lang, { maximumFractionDigits: 2 })}
          note={t('units.rsun')}
        />
        <Row
          label={t('panel.exoplanets')}
          value={t('panel.planetsCount', { count: host.planets.length })}
        />
      </dl>
      <ul className="mt-2 text-sm text-white/80" data-testid="planet-list">
        {host.planets.map((p) => (
          <li key={p.pl_name} className="border-b border-white/10 py-1">
            {p.pl_name}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => useGalaxyMapStore.getState().enterSystemView(hostname)}
        className="mt-3 w-full rounded bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
        data-testid="view-system-button"
      >
        {t('panel.viewSystem')}
      </button>
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
    <aside
      role="region"
      aria-label={t('panel.regionLabel')}
      data-testid="star-panel"
      className="absolute top-4 right-4 z-10 max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-lg bg-zinc-900/90 p-4 shadow-xl backdrop-blur"
    >
      <button
        type="button"
        onClick={() => selectStar(null)}
        aria-label={t('panel.close')}
        data-testid="panel-close"
        className="absolute top-2 right-2 rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
      {selection.kind === 'star' ? (
        <StarDetails index={selection.index} />
      ) : selection.kind === 'host' ? (
        <HostDetails hostname={selection.hostname} />
      ) : null}
    </aside>
  );
}
