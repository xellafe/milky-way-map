import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeRange, type Range } from '../../lib/filterMask';
import { formatNumber } from '../../lib/format';

const NUMBER_CLASS =
  'w-full border-0 bg-transparent p-0 font-hud-mono text-xs text-hud-bright focus:bg-black/40 focus:outline focus:outline-1 focus:outline-hud-accent disabled:opacity-40';

type Side = 'min' | 'max';

/**
 * Number field that applies only on blur/Enter (#40): applying per keystroke
 * let transient values ("5" on the way to "50") reach the store and swap the
 * ends. Escape and bad input revert; unchanged text is a no-op, so a displayed
 * rounded bound never turns into an active filter.
 */
function RangeNumberField({
  side,
  label,
  current,
  decimals,
  className,
  testId,
  onCommit,
}: {
  side: Side;
  label: string;
  current: number;
  decimals: number;
  className: string;
  testId: string;
  /** `null` = field emptied (that side returns to its data bound). */
  onCommit: (side: Side, value: number | null) => void;
}) {
  // null = not editing: the field shows the store value.
  const [draft, setDraft] = useState<string | null>(null);
  const display = String(Number(current.toFixed(decimals)));

  const commit = (el: HTMLInputElement) => {
    const text = draft;
    setDraft(null);
    if (text === null || text === display) return;
    // badInput: the browser holds unparsable text (e.g. "-") and reports "".
    if (el.validity.badInput) return;
    if (el.value.trim() === '') {
      onCommit(side, null);
      return;
    }
    const value = Number(el.value);
    if (Number.isFinite(value)) onCommit(side, value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(e.currentTarget);
    else if (e.key === 'Escape' && draft !== null) {
      // Consumed by the revert: the dock closes on Escape unless prevented.
      e.preventDefault();
      setDraft(null);
    }
  };

  return (
    <label className="flex-1">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        step={10 ** -decimals}
        value={draft ?? display}
        data-testid={testId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={onKeyDown}
        className={className}
      />
    </label>
  );
}

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
  // A neutral side sits at the slider end, where End/Home leaves it (#40).
  const sliderLo = value?.[0] ?? sliderMin;
  const sliderHi = value?.[1] ?? sliderMax;

  // Sliders and fields share one rule (#40): clamp, never swap, full bounds = null.
  const apply = (side: Side, next: number | null) => {
    if (!bounds) return;
    const target = next ?? (side === 'min' ? bounds[0] : bounds[1]);
    if (Number.isNaN(target)) return;
    onChange(normalizeRange(side, target, side === 'min' ? hi : lo, bounds));
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
          value={sliderLo}
          data-testid={`filter-${id}-min-slider`}
          onChange={(e) => apply('min', e.target.valueAsNumber)}
        />
        <input
          type="range"
          className="hud-range"
          aria-label={`${label} ${t('filters.max')}`}
          min={sliderMin}
          max={sliderMax}
          step="any"
          value={sliderHi}
          data-testid={`filter-${id}-max-slider`}
          onChange={(e) => apply('max', e.target.valueAsNumber)}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <RangeNumberField
          side="min"
          label={t('filters.min')}
          current={lo}
          decimals={decimals}
          className={NUMBER_CLASS}
          testId={`filter-${id}-min`}
          onCommit={apply}
        />
        <span className="text-hud-muted">–</span>
        <RangeNumberField
          side="max"
          label={t('filters.max')}
          current={hi}
          decimals={decimals}
          className={`${NUMBER_CLASS} text-right`}
          testId={`filter-${id}-max`}
          onCommit={apply}
        />
      </div>
    </fieldset>
  );
}
