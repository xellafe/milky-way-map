import { useTranslation } from 'react-i18next';
import { useGalaxyMapStore } from '../state/store';

/**
 * View toggles (SPEC §6.2): always-on star names and constellation lines.
 * Both default OFF (no clutter in the default configuration — M6 AC).
 */
export function ViewTogglesPanel() {
  const { t } = useTranslation();
  const showNames = useGalaxyMapStore((s) => s.showNames);
  const showConstellations = useGalaxyMapStore((s) => s.showConstellations);
  const toggleNames = useGalaxyMapStore((s) => s.toggleNames);
  const toggleConstellations = useGalaxyMapStore((s) => s.toggleConstellations);

  return (
    <section
      aria-label={t('view.title')}
      data-testid="view-toggles"
      className="absolute right-4 bottom-4 z-10 flex flex-col gap-1 rounded-lg bg-zinc-900/90 p-3 text-sm text-white shadow-xl backdrop-blur"
    >
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showNames}
          data-testid="toggle-names"
          onChange={toggleNames}
        />
        {t('view.showNames')}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showConstellations}
          data-testid="toggle-constellations"
          onChange={toggleConstellations}
        />
        {t('view.showConstellations')}
      </label>
    </section>
  );
}
