import { useTranslation } from 'react-i18next';
import type { ExoHost } from '../data/exoplanets';
import { getNamesEntry } from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
import { getStarDetails } from '../data/starDetailsStore';
import { FLAG_MULTIPLE, FLAG_VARIABLE, formatNumber, hasFlag } from '../lib/format';
import { formatLimited, metallicityRatioTag } from '../lib/limitedValue';
import { useGalaxyMapStore } from '../state/store';
import { DataRow } from './hud/DataRow';
import { DataSection } from './hud/DataSection';
import { HudButton } from './hud/HudButton';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** Absolute magnitude, B–V and age of a catalog star. */
export function StarExtraRows({ index }: { index: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const details = getStarDetails();
  const { host } = useStarHost(index);
  const bv = details ? details.colorIndex[index]! : Number.NaN;
  return (
    <dl>
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
        value={formatLimited(
          host?.st_age ?? null,
          host?.st_agelim ?? null,
          lang,
          3,
          t('units.gyr'),
        )}
        note={t('panel.ageNote')}
        warnNote
        testId="star-age"
      />
    </dl>
  );
}

/** Catalog identifiers and flags of a catalog star. */
export function CatalogSection({ index }: { index: number }) {
  const { t } = useTranslation();
  const flags = getStarCore()?.flags[index] ?? 0;
  const entry = getNamesEntry(index);
  const { catalogIds } = useStarTitle(index);

  const ids: string[] = [];
  if (entry?.hd) ids.push(`HD ${entry.hd}`);
  if (entry?.hip) ids.push(`HIP ${entry.hip}`);
  if (entry?.gl) ids.push(entry.gl);
  if (catalogIds?.tyc) ids.push(`TYC ${catalogIds.tyc}`);
  if (catalogIds?.gaia) ids.push(`Gaia DR3 ${catalogIds.gaia}`);

  return (
    <DataSection title={t('card.sectionCatalog')}>
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
    </DataSection>
  );
}

/**
 * Host-star data from the NASA Exoplanet Archive (#18); absent fields read n/a.
 * `withAge={false}` where StarExtraRows is shown: it already carries the age with
 * its uncertainty note (SPEC §6.6), and a datum appears once (#23).
 */
export function ArchiveSection({ host, withAge = true }: { host: ExoHost; withAge?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const tag = metallicityRatioTag(host.st_metratio);
  return (
    <DataSection title={t('card.sectionArchive')}>
      <DataRow
        label={tag ? `${t('panel.advMetallicity')} ${tag}` : t('panel.advMetallicity')}
        value={formatLimited(host.st_met, host.st_metlim, lang, 3, t('units.dex'))}
        testId="adv-st_met"
      />
      {withAge && (
        <DataRow
          label={t('panel.advAge')}
          value={formatLimited(host.st_age, host.st_agelim, lang, 3, t('units.gyr'))}
          testId="adv-st_age"
        />
      )}
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
    </DataSection>
  );
}

/** Opens the System View of the star's exoplanet host; disabled until the host resolves. */
export function ViewSystemButton({ index }: { index: number }) {
  const { t } = useTranslation();
  const { hostname, host } = useStarHost(index);
  return (
    <HudButton
      variant="secondary"
      disabled={!hostname}
      onClick={() => {
        if (hostname) useGalaxyMapStore.getState().enterSystemView(hostname);
      }}
      className="w-full"
      data-testid="view-system-button"
    >
      {host ? t('panel.viewSystemCount', { count: host.planets.length }) : t('panel.viewSystem')}
    </HudButton>
  );
}
