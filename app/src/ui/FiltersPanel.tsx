import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isDefaultFilters, type Filters, type Range } from '../lib/filterMask';
import { formatNumber } from '../lib/format';
import { useGalaxyMapStore } from '../state/store';

const SPECTRAL_LABELS = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

function RangeFilter({
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

  const apply = (nextLo: number, nextHi: number) => {
    if (!bounds) return;
    if (Number.isNaN(nextLo) || Number.isNaN(nextHi)) return;
    onChange([Math.min(nextLo, nextHi), Math.max(nextLo, nextHi)]);
  };

  return (
    <fieldset className="mt-2" data-testid={`filter-${id}`} disabled={disabled}>
      <legend className="text-xs text-white/60">
        {label}
        {bounds && (
          <span className="ml-1 text-white/40">
            ({formatNumber(bounds[0], i18n.language, { maximumFractionDigits: decimals })} –{' '}
            {formatNumber(bounds[1], i18n.language, { maximumFractionDigits: decimals })})
          </span>
        )}
      </legend>
      <div className="mt-1 flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">{t('filters.min')}</span>
          <input
            type="number"
            step={step}
            value={Number(lo.toFixed(decimals))}
            data-testid={`filter-${id}-min`}
            onChange={(e) => apply(e.target.valueAsNumber, hi)}
            className="w-full rounded bg-white/10 px-2 py-1 text-sm text-white disabled:opacity-40"
          />
        </label>
        <span className="text-white/40">–</span>
        <label className="flex-1">
          <span className="sr-only">{t('filters.max')}</span>
          <input
            type="number"
            step={step}
            value={Number(hi.toFixed(decimals))}
            data-testid={`filter-${id}-max`}
            onChange={(e) => apply(lo, e.target.valueAsNumber)}
            className="w-full rounded bg-white/10 px-2 py-1 text-sm text-white disabled:opacity-40"
          />
        </label>
      </div>
    </fieldset>
  );
}

/** Runtime filters panel (SPEC §6.5) — GPU mask only, no data reload. */
export function FiltersPanel() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const filters = useGalaxyMapStore((s) => s.filters);
  const setFilters = useGalaxyMapStore((s) => s.setFilters);
  const resetFilters = useGalaxyMapStore((s) => s.resetFilters);
  const bounds = useGalaxyMapStore((s) => s.dataBounds);
  const visibleCount = useGalaxyMapStore((s) => s.visibleCount);

  const toggleClass = (code: number) => {
    // Read the LATEST filters from the store, not the render closure: rapid
    // sequential clicks would otherwise build on a stale array and silently
    // revert a previous toggle (React batches re-renders between clicks).
    const next = [...useGalaxyMapStore.getState().filters.spectralClasses];
    next[code] = !next[code];
    setFilters({ spectralClasses: next });
  };

  const setToggle = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters({ [key]: e.target.checked });

  return (
    <div className="absolute bottom-4 left-4 z-10 w-80">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="filters-panel"
        data-testid="filters-toggle"
        className="rounded-lg bg-zinc-900/90 px-3 py-2 text-sm text-white shadow-xl backdrop-blur hover:bg-zinc-800/90"
      >
        {t('filters.title')}
        {visibleCount !== null && (
          <span className="ml-2 text-white/50" data-testid="visible-count">
            {formatNumber(visibleCount, i18n.language)}
          </span>
        )}
      </button>

      {open && (
        <section
          id="filters-panel"
          aria-label={t('filters.title')}
          data-testid="filters-panel"
          className="mt-1 max-h-[60vh] overflow-y-auto rounded-lg bg-zinc-900/95 p-3 text-white shadow-xl backdrop-blur"
        >
          <fieldset>
            <legend className="text-xs text-white/60">{t('filters.spectralClass')}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {SPECTRAL_LABELS.map((letter, code) => (
                <label key={letter} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.spectralClasses[code] === true}
                    data-testid={`filter-class-${letter}`}
                    onChange={() => toggleClass(code)}
                  />
                  {letter}
                </label>
              ))}
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={filters.spectralClasses[7] === true}
                  data-testid="filter-class-unknown"
                  onChange={() => toggleClass(7)}
                />
                {t('filters.unknown')}
              </label>
            </div>
          </fieldset>

          <RangeFilter
            id="distance"
            label={`${t('filters.distance')} (${t('units.ly')})`}
            bounds={bounds?.distanceLy ?? null}
            value={filters.distanceLy}
            decimals={0}
            onChange={(range) => setFilters({ distanceLy: range })}
          />
          <RangeFilter
            id="appmag"
            label={t('filters.appMag')}
            bounds={bounds?.appMag ?? null}
            value={filters.appMag}
            decimals={1}
            onChange={(range) => setFilters({ appMag: range })}
          />
          <RangeFilter
            id="absmag"
            label={t('filters.absMag')}
            bounds={bounds?.absMag ?? null}
            value={filters.absMag}
            decimals={1}
            onChange={(range) => setFilters({ absMag: range })}
          />

          <div className="mt-3 flex flex-col gap-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyExoplanets}
                data-testid="filter-exoplanets"
                onChange={setToggle('onlyExoplanets')}
              />
              {t('filters.onlyExoplanets')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyMultiple}
                data-testid="filter-multiple"
                onChange={setToggle('onlyMultiple')}
              />
              {t('filters.onlyMultiple')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyVariable}
                data-testid="filter-variable"
                onChange={setToggle('onlyVariable')}
              />
              {t('filters.onlyVariable')}
            </label>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            disabled={isDefaultFilters(filters)}
            data-testid="filters-reset"
            className="mt-3 w-full rounded bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('filters.reset')}
          </button>
        </section>
      )}
    </div>
  );
}
