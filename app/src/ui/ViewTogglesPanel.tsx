import { useTranslation } from 'react-i18next';
import { useGalaxyMapStore } from '../state/store';
import { HudSwitch } from './hud/HudInputs';

/**
 * View toggles (SPEC §6.2): always-on star names and constellation lines.
 * Both default OFF (no clutter in the default configuration — M6 AC).
 * Content only: the dock panel (ControlDock) owns the frame (issue #3).
 */
export function ViewTogglesPanel() {
  const { t } = useTranslation();
  const showNames = useGalaxyMapStore((s) => s.showNames);
  const showConstellations = useGalaxyMapStore((s) => s.showConstellations);
  const toggleNames = useGalaxyMapStore((s) => s.toggleNames);
  const toggleConstellations = useGalaxyMapStore((s) => s.toggleConstellations);

  return (
    <section
      id="dock-panel-view"
      aria-label={t('view.title')}
      data-testid="view-toggles"
      className="flex flex-col gap-1"
    >
      <HudSwitch
        label={t('view.showNames')}
        checked={showNames}
        data-testid="toggle-names"
        onChange={toggleNames}
      />
      <HudSwitch
        label={t('view.showConstellations')}
        checked={showConstellations}
        data-testid="toggle-constellations"
        onChange={toggleConstellations}
      />
    </section>
  );
}
