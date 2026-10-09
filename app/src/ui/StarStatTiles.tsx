import { useTranslation } from 'react-i18next';
import { getStarDetails } from '../data/starDetailsStore';
import { formatNumber } from '../lib/format';
import {
  DISTANCE_TICKS,
  LUMINOSITY_TICKS,
  MAGNITUDE_TICKS,
  MAGNITUDE_ZONES,
  TEMPERATURE_TICKS,
  distanceScale,
  luminosityScale,
  magnitudeScale,
  temperatureScale,
  visibilityVerdict,
} from '../lib/gaugeScale';
import { estimateTeffFromBV } from '../lib/teff';
import { StatTile } from './hud/StatTile';

const VERDICT_KEYS = {
  nakedEye: 'gauge.verdictNakedEye',
  binocular: 'gauge.verdictBinocular',
  telescope: 'gauge.verdictTelescope',
} as const;

/** Four headline stats of a catalog star (distance, temperature, luminosity,
 * apparent magnitude), each with a gauge. */
export function StarStatTiles({ index, compact = false }: { index: number; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const details = getStarDetails();

  const distance = details?.distanceLy[index] ?? null;
  const luminosity = details?.luminosity[index] ?? null;
  const appMag = details?.appMag[index] ?? null;
  const teff = details ? estimateTeffFromBV(details.colorIndex[index]!) : null;
  const verdict = visibilityVerdict(appMag);
  const fmt = (v: number | null, o: Intl.NumberFormatOptions) => formatNumber(v, lang, o);

  return (
    <div className={compact ? 'flex flex-col gap-1.5' : 'grid grid-cols-2 gap-2'}>
      <StatTile
        testId="stat-distance"
        compact={compact}
        label={t('panel.distance')}
        value={fmt(distance, { maximumFractionDigits: 1 })}
        unit={t('units.ly')}
        position={distanceScale(distance)}
        ticks={DISTANCE_TICKS.map((k) => ({
          ...k,
          // 'always' groups 4-digit numbers in it/es, whose locale default skips them.
          label: formatNumber(k.value, lang, { useGrouping: 'always' }) ?? undefined,
        }))}
      />
      <StatTile
        testId="stat-teff"
        compact={compact}
        label={t('panel.teff')}
        value={teff === null ? null : `≈ ${formatNumber(Math.round(teff), lang)}`}
        unit={t('units.kelvin')}
        estimate
        variant="spectral"
        position={temperatureScale(teff)}
        ticks={TEMPERATURE_TICKS}
      />
      <StatTile
        testId="stat-luminosity"
        compact={compact}
        label={t('panel.luminosity')}
        value={fmt(luminosity, { maximumSignificantDigits: 3 })}
        unit={t('units.lsun')}
        position={luminosityScale(luminosity)}
        ticks={LUMINOSITY_TICKS}
      />
      <StatTile
        testId="stat-appmag"
        compact={compact}
        label={t('panel.apparentMagnitude')}
        value={fmt(appMag, { maximumFractionDigits: 2 })}
        position={magnitudeScale(appMag)}
        ticks={MAGNITUDE_TICKS}
        zones={MAGNITUDE_ZONES.map((z) => ({
          from: z.from,
          to: z.to,
          label: t(`gauge.${z.kind}`),
          strong: z.kind === 'nakedEye',
        }))}
        // A fill from the left would cover the zone band; the zones carry the meaning.
        fill={false}
        verdict={verdict ? t(VERDICT_KEYS[verdict]) : undefined}
      />
    </div>
  );
}
