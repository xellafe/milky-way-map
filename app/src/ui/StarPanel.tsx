import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHost, isExoplanetsReady, loadExoplanets } from '../data/exoplanets';
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
import { useGalaxyMapStore } from '../state/store';
import { Badge } from './hud/Badge';
import { HudButton } from './hud/HudButton';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

function Row({
  label,
  value,
  note,
  warnNote = false,
}: {
  label: string;
  value: string | null;
  note?: string;
  warnNote?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between gap-4 border-b border-hud-accent/20 py-1.5">
      <dt className="text-hud-muted">{label}</dt>
      <dd className="text-right font-hud-mono text-hud-bright">
        {value ?? t('panel.na')}
        {note && value !== null && (
          <span className={`ml-1 text-xs ${warnNote ? 'text-hud-warn' : 'text-hud-muted'}`}>
            {note}
          </span>
        )}
      </dd>
    </div>
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
        {/* Age is not present in HYG/AT-HYG → always n/d in v1 (SPEC §6.6: never fabricated). */}
        <Row label={t('panel.age')} value={null} note={t('panel.ageNote')} warnNote />
      </dl>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer py-1 text-hud-muted hover:text-hud-bright">
          {t('panel.moreData')}
        </summary>
        <dl>
          <Row label={t('panel.catalogIds')} value={ids.length > 0 ? ids.join(' · ') : null} />
          {/* Luminosity class is not in the data contract (SPEC §5.1) → n/d, never guessed. */}
          <Row label={t('panel.msClass')} value={null} />
          <Row
            label={t('panel.variable')}
            value={t(hasFlag(flags, FLAG_VARIABLE) ? 'panel.yes' : 'panel.no')}
          />
          <Row
            label={t('panel.multiple')}
            value={t(hasFlag(flags, FLAG_MULTIPLE) ? 'panel.yes' : 'panel.no')}
          />
        </dl>
      </details>
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
    <aside
      role="region"
      aria-label={t('panel.regionLabel')}
      data-testid="star-panel"
      data-hud="star-panel"
      className="hud-panel absolute top-16 right-4 z-10 max-h-[calc(100%-5rem)] w-80 overflow-y-auto rounded-hud p-4"
    >
      <button
        type="button"
        onClick={() => selectStar(null)}
        aria-label={t('panel.close')}
        data-testid="panel-close"
        data-hud="panel-close"
        className="absolute top-2 right-2 rounded px-2 py-0.5 text-hud-muted hover:bg-white/10 hover:text-hud-bright"
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
