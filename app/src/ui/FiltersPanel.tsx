import { useTranslation } from 'react-i18next';
import { isDefaultFilters, type Filters } from '../lib/filterMask';
import { spectralChipColor, type SpectralLetter } from '../lib/spectralChip';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';
import { HudSwitch } from './hud/HudInputs';
import { HudCard } from './hud/HudCard';
import { RangeSlider } from './hud/RangeSlider';
import { ToggleChip } from './hud/ToggleChip';

const SPECTRAL_LABELS: SpectralLetter[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];

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
    <HudCard
      as="section"
      id="dock-panel-filters"
      aria-label={t('filters.title')}
      data-testid="filters-panel"
      className="max-h-[60vh] w-80 overflow-y-auto p-3"
    >
      <fieldset>
        <legend className="font-hud text-xs text-hud-muted">{t('filters.spectralClass')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {SPECTRAL_LABELS.map((letter, code) => (
            <ToggleChip
              key={letter}
              label={letter}
              pressed={filters.spectralClasses[code] === true}
              color={spectralChipColor(letter)}
              testId={`filter-class-${letter}`}
              onToggle={() => toggleClass(code)}
            />
          ))}
          <ToggleChip
            label="?"
            ariaLabel={t('filters.unknown')}
            color="var(--color-hud-muted)"
            pressed={filters.spectralClasses[7] === true}
            testId="filter-class-unknown"
            onToggle={() => toggleClass(7)}
          />
        </div>
      </fieldset>

      <RangeSlider
        id="distance"
        label={`${t('filters.distance')} (${t('units.ly')})`}
        bounds={bounds?.distanceLy ?? null}
        value={filters.distanceLy}
        decimals={0}
        onChange={(range) => setFilters({ distanceLy: range })}
      />
      <RangeSlider
        id="appmag"
        label={t('filters.appMag')}
        bounds={bounds?.appMag ?? null}
        value={filters.appMag}
        decimals={1}
        onChange={(range) => setFilters({ appMag: range })}
      />
      <RangeSlider
        id="absmag"
        label={t('filters.absMag')}
        bounds={bounds?.absMag ?? null}
        value={filters.absMag}
        decimals={1}
        onChange={(range) => setFilters({ absMag: range })}
      />

      <div className="mt-3 flex flex-col gap-1">
        <HudSwitch
          label={t('filters.onlyExoplanets')}
          checked={filters.onlyExoplanets}
          data-testid="filter-exoplanets"
          onChange={setToggle('onlyExoplanets')}
        />
        <HudSwitch
          label={t('filters.onlyMultiple')}
          checked={filters.onlyMultiple}
          data-testid="filter-multiple"
          onChange={setToggle('onlyMultiple')}
        />
        <HudSwitch
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
    </HudCard>
  );
}
