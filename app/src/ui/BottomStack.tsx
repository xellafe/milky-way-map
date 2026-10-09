import { useGalaxyMapStore } from '../state/store';
import { ControlDock, DockPanel } from './ControlDock';
import { TimeBar } from './TimeBar';

/**
 * Bottom-center column: dock panel, time bar (System View), dock bar. Stacking
 * by flow instead of computed offsets keeps the parts from overlapping; the
 * column ignores pointer events so only its cards capture them.
 */
export function BottomStack() {
  const view = useGalaxyMapStore((s) => s.view);
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
