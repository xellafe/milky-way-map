import { useTranslation } from 'react-i18next';
import type { Range } from '../../lib/filterMask';
import { formatNumber } from '../../lib/format';

const NUMBER_CLASS =
  'w-full border-0 bg-transparent p-0 font-hud-mono text-xs text-hud-bright focus:bg-black/40 focus:outline focus:outline-1 focus:outline-hud-accent disabled:opacity-40';

/** Dual-thumb range filter: two stacked range inputs plus editable numbers. */
export function RangeSlider({
  id,
  label,
  bounds,
  value,
  decimals,
  onChange,
}: {
  id: string;
  label: string;
  bounds: Range | null;
  value: Range | null;
  decimals: number;
  onChange: (range: Range | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const disabled = bounds === null;
  const lo = value?.[0] ?? bounds?.[0] ?? 0;
  const hi = value?.[1] ?? bounds?.[1] ?? 0;
  const step = 10 ** -decimals;
  // Rounded outward so the slider ends never cut off data and the attribute
  // strings stay short (float32 bounds serialize with spurious digits).
  const sliderMin = bounds ? Number((Math.floor(bounds[0] / step) * step).toFixed(decimals)) : 0;
  const sliderMax = bounds ? Number((Math.ceil(bounds[1] / step) * step).toFixed(decimals)) : 0;

  const apply = (nextLo: number, nextHi: number) => {
    if (!bounds) return;
    if (Number.isNaN(nextLo) || Number.isNaN(nextHi)) return;
    onChange([Math.min(nextLo, nextHi), Math.max(nextLo, nextHi)]);
  };

  return (
    <fieldset className="mt-2" data-testid={`filter-${id}`} disabled={disabled}>
      <legend className="font-hud text-xs text-hud-muted">
        {label}
        {bounds && (
          <span className="ml-1 text-hud-muted">
            ({formatNumber(bounds[0], i18n.language, { maximumFractionDigits: decimals })} –{' '}
            {formatNumber(bounds[1], i18n.language, { maximumFractionDigits: decimals })})
          </span>
        )}
      </legend>
      {/* Only the thumbs take pointer events (.hud-range-dual in index.css), so
          the upper input does not shadow the lower one. */}
      <div className="hud-range-dual relative mt-1 h-4">
        <input
          type="range"
          className="hud-range"
          aria-label={`${label} ${t('filters.min')}`}
          min={sliderMin}
          max={sliderMax}
          // 'any': a step grid from min would leave the far-right thumb below the
          // raw data max and hide extreme stars; the number fields do the rounding.
          step="any"
          value={lo}
          data-testid={`filter-${id}-min-slider`}
          onChange={(e) => apply(e.target.valueAsNumber, hi)}
        />
        <input
          type="range"
          className="hud-range"
          aria-label={`${label} ${t('filters.max')}`}
          min={sliderMin}
          max={sliderMax}
          step="any"
          value={hi}
          data-testid={`filter-${id}-max-slider`}
          onChange={(e) => apply(lo, e.target.valueAsNumber)}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">{t('filters.min')}</span>
          <input
            type="number"
            step={step}
            value={Number(lo.toFixed(decimals))}
            data-testid={`filter-${id}-min`}
            onChange={(e) => apply(e.target.valueAsNumber, hi)}
            className={NUMBER_CLASS}
          />
        </label>
        <span className="text-hud-muted">–</span>
        <label className="flex-1">
          <span className="sr-only">{t('filters.max')}</span>
          <input
            type="number"
            step={step}
            value={Number(hi.toFixed(decimals))}
            data-testid={`filter-${id}-max`}
            onChange={(e) => apply(lo, e.target.valueAsNumber)}
            className={`${NUMBER_CLASS} text-right`}
          />
        </label>
      </div>
    </fieldset>
  );
}
