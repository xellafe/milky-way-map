import { getPlacedLabels } from '../data/labelStore';
import { useGalaxyMapStore } from '../state/store';

/**
 * DOM layer for the always-on star labels (SPEC §6.2). Re-renders on the
 * labelsVersion bump and reads the placed labels from the module holder
 * (≤ MAX_LABELS tiny objects). Pointer-events off: labels never block
 * picking or camera drags.
 */
export function StarLabelsLayer() {
  const show = useGalaxyMapStore((s) => s.showNames);
  useGalaxyMapStore((s) => s.labelsVersion);
  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {getPlacedLabels().map((label) => (
        <span
          key={label.index}
          data-testid="star-label"
          className="absolute -translate-x-1/2 rounded bg-black/40 px-1 text-xs whitespace-nowrap text-white/80"
          style={{ left: label.x, top: label.y + 8 }}
        >
          {label.label}
        </span>
      ))}
    </div>
  );
}
