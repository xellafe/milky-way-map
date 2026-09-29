import { useTranslation } from 'react-i18next';
import { useGalaxyMapStore } from '../state/store';
import { HudCheckbox } from './hud/HudInputs';
import { HudPanel } from './hud/HudPanel';

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
    <HudPanel
      aria-label={t('view.title')}
      data-testid="view-toggles"
      className="absolute right-4 bottom-4 z-10 flex flex-col gap-1"
    >
      <HudCheckbox
        label={t('view.showNames')}
        checked={showNames}
        data-testid="toggle-names"
        onChange={toggleNames}
      />
      <HudCheckbox
        label={t('view.showConstellations')}
        checked={showConstellations}
        data-testid="toggle-constellations"
        onChange={toggleConstellations}
      />
    </HudPanel>
  );
}
