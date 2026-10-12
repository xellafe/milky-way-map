import { useTranslation } from 'react-i18next';
import { useLayoutMode } from '../lib/viewport';
import { useGalaxyMapStore } from '../state/store';
import { ControlDock, DockPanel } from './ControlDock';
import { MobileSheet } from './MobileSheet';
import { TimeBar } from './TimeBar';

/**
 * Bottom-center column: dock panel, time bar (System View), dock bar. Stacking
 * by flow instead of computed offsets keeps the parts from overlapping; the
 * column ignores pointer events so only its cards capture them.
 *
 * Phone (#25): the dock panel moves into the sheet (the time bar becomes its Time
 * tab), and the bar sits over the sheet's bottom reserve (landscape: only under the scene area, left of the sheet).
 */
export function BottomStack() {
  const { t } = useTranslation();
  const view = useGalaxyMapStore((s) => s.view);
  const dockPanel = useGalaxyMapStore((s) => s.dockPanel);
  const layout = useLayoutMode();
  if (layout === 'desktop') {
    return (
      <div
        data-hud="bottom-stack"
        className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <DockPanel />
        {view === 'system' && <TimeBar />}
        <ControlDock />
      </div>
    );
  }
  return (
    <>
      {dockPanel && (
        <MobileSheet label={t('dock.label')}>
          <DockPanel sheet />
        </MobileSheet>
      )}
      <div
        data-hud="bottom-stack"
        className={`pointer-events-none absolute bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-0 z-40 flex flex-col items-center gap-2 ${
          layout === 'landscape' ? 'right-[50vw]' : 'right-0'
        }`}
      >
        <ControlDock />
      </div>
    </>
  );
}
