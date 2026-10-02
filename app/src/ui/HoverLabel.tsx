import { useEffect, useState } from 'react';
import { fetchCatalogIds } from '../data/catalogIds';
import { entryLabel, getNamesEntry } from '../data/namesIndex';
import { useGalaxyMapStore } from '../state/store';

/**
 * Hover name label (SPEC §6.2): proper name when present, otherwise the
 * primary catalog id. Classic-index stars resolve synchronously at render;
 * other stars get their Gaia/TYC id via a 16-byte Range request (async).
 */
export function HoverLabel() {
  const hovered = useGalaxyMapStore((s) => s.hoveredStarIndex);
  const [asyncLabel, setAsyncLabel] = useState<{ index: number; label: string } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const entry = hovered !== null ? getNamesEntry(hovered) : null;
  const classicLabel = entry ? entryLabel(entry) : null;

  useEffect(() => {
    if (hovered === null || getNamesEntry(hovered)) return;
    let cancelled = false;
    fetchCatalogIds(hovered)
      .then((ids) => {
        if (cancelled) return;
        const label = ids.tyc ? `TYC ${ids.tyc}` : ids.gaia ? `Gaia DR3 ${ids.gaia}` : null;
        if (label) setAsyncLabel({ index: hovered, label });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hovered]);

  const label = classicLabel ?? (asyncLabel?.index === hovered ? asyncLabel.label : null);
  if (hovered === null || !label) return null;

  return (
    <div
      className="hud-panel pointer-events-none fixed z-20 rounded-hud px-2 py-0.5 font-hud text-sm text-hud-text"
      style={{ left: pos.x + 14, top: pos.y + 10 }}
      data-testid="hover-label"
    >
      {label}
    </div>
  );
}
