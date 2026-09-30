import { useTranslation } from 'react-i18next';
import { isDefaultFilters, type Filters, type Range } from '../lib/filterMask';
import { formatNumber } from '../lib/format';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';
import { HudCheckbox } from './hud/HudInputs';
import { HudPanel } from './hud/HudPanel';

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
      <legend className="font-hud text-xs text-hud-muted">
        {label}
        {bounds && (
          <span className="ml-1 text-hud-muted">
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
            className="w-full rounded border border-hud-accent/30 bg-black/40 px-2 py-1 font-hud-mono text-sm text-hud-text disabled:opacity-40"
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
            className="w-full rounded border border-hud-accent/30 bg-black/40 px-2 py-1 font-hud-mono text-sm text-hud-text disabled:opacity-40"
          />
        </label>
      </div>
    </fieldset>
  );
}

/**
 * Runtime filters panel (SPEC §6.5) — GPU mask only, no data reload.
 * Content only: the dock (ControlDock/Dock) owns the toggle icon,
 * positioning and open/close state (issue #3).
 */
export function FiltersPanel() {
  const { t } = useTranslation();
  const filters = useGalaxyMapStore((s) => s.filters);
  const setFilters = useGalaxyMapStore((s) => s.setFilters);
  const resetFilters = useGalaxyMapStore((s) => s.resetFilters);
  const bounds = useGalaxyMapStore((s) => s.dataBounds);

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
    <HudPanel
      id="dock-panel-filters"
      aria-label={t('filters.title')}
      data-testid="filters-panel"
      className="max-h-[60vh] w-80 overflow-x-hidden overflow-y-auto"
    >
      <fieldset>
        <legend className="font-hud text-xs text-hud-muted">{t('filters.spectralClass')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {SPECTRAL_LABELS.map((letter, code) => (
            <HudCheckbox
              key={letter}
              label={letter}
              checked={filters.spectralClasses[code] === true}
              data-testid={`filter-class-${letter}`}
              onChange={() => toggleClass(code)}
            />
          ))}
          <HudCheckbox
            label={t('filters.unknown')}
            checked={filters.spectralClasses[7] === true}
            data-testid="filter-class-unknown"
            onChange={() => toggleClass(7)}
          />
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

      <div className="mt-3 flex flex-col gap-1">
        <HudCheckbox
          label={t('filters.onlyExoplanets')}
          checked={filters.onlyExoplanets}
          data-testid="filter-exoplanets"
          onChange={setToggle('onlyExoplanets')}
        />
        <HudCheckbox
          label={t('filters.onlyMultiple')}
          checked={filters.onlyMultiple}
          data-testid="filter-multiple"
          onChange={setToggle('onlyMultiple')}
        />
        <HudCheckbox
          label={t('filters.onlyVariable')}
          checked={filters.onlyVariable}
          data-testid="filter-variable"
          onChange={setToggle('onlyVariable')}
        />
      </div>

      <HudButton
        variant="secondary"
        onClick={resetFilters}
        disabled={isDefaultFilters(filters)}
        data-testid="filters-reset"
        className="mt-3 w-full"
      >
        {t('filters.reset')}
      </HudButton>
    </HudPanel>
  );
}
