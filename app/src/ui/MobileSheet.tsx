import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLayoutMode } from '../lib/viewport';
import type { SheetSnap } from '../lib/sheet';
import { useGalaxyMapStore } from '../state/store';

// Sheet size per snap as a fraction of the viewport side it grows along (height in
// portrait, width in landscape, where it also stays under half of the screen).
// Aesthetic choice (not data).
const FRACTION = {
  portrait: { base: 0.4, expanded: 0.85 },
  landscape: { base: 0.4, expanded: 0.5 },
} as const;

// Pointer travel under which a press on the handle is a tap, px. Aesthetic choice (not data).
const TAP_SLOP_PX = 6;

/**
 * Single phone sheet (#25, spec §4.1): bottom in portrait, right in landscape.
 * The handle taps between base and expanded and drags to the nearest snap; below
 * half of the base the sheet closes to the handle alone.
 */
export function MobileSheet({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  const layout = useLayoutMode();
  const snap = useGalaxyMapStore((s) => s.sheetSnap);
  const setSnap = useGalaxyMapStore((s) => s.setSheetSnap);
  const orientation = layout === 'landscape' ? 'landscape' : 'portrait';
  const portrait = orientation === 'portrait';
  // Live size in px while the handle is dragged; null otherwise.
  const [dragPx, setDragPx] = useState<number | null>(null);
  const press = useRef<{ start: number; startSize: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const root = useRef<HTMLElement>(null);
  const contentId = useId();

  const along = (e: PointerEvent) => (portrait ? e.clientY : e.clientX);
  const sizeOf = () => {
    const r = root.current!.getBoundingClientRect();
    return portrait ? r.height : r.width;
  };
  const viewportSide = () => {
    const r = root.current!.parentElement!.getBoundingClientRect();
    return portrait ? r.height : r.width;
  };

  const onPointerDown = (e: PointerEvent) => {
    dragged.current = false;
    press.current = { start: along(e), startSize: sizeOf(), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    // The sheet grows against the edge it is anchored to: up in portrait, left in landscape.
    const delta = p.start - along(e);
    if (!p.moved && Math.abs(delta) < TAP_SLOP_PX) return;
    p.moved = true;
    setDragPx(Math.max(0, Math.min(viewportSide(), p.startSize + delta)));
  };
  const onPointerUp = () => {
    const p = press.current;
    press.current = null;
    if (!p?.moved) return; // a tap: onClick toggles
    dragged.current = true; // the click that follows a drag must not toggle
    const side = viewportSide();
    const f = FRACTION[orientation];
    const size = dragPx ?? p.startSize;
    setDragPx(null);
    if (size < (f.base * side) / 2) setSnap('closed');
    else setSnap(size - f.base * side < f.expanded * side - size ? 'base' : 'expanded');
  };
  const onClick = () => {
    if (dragged.current) dragged.current = false;
    else setSnap(snap === 'base' ? 'expanded' : 'base'); // closed reopens at base
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Escape is consumed even when already closed so the document listeners (dock panel,
    // deselect) do not fire from the handle (#43).
    if (e.key === 'Escape') {
      e.preventDefault();
      setSnap('closed');
      return;
    }
    const growKey = portrait ? 'ArrowUp' : 'ArrowLeft';
    const shrinkKey = portrait ? 'ArrowDown' : 'ArrowRight';
    if (e.key !== growKey && e.key !== shrinkKey) return; // other axis: left to the browser
    e.preventDefault();
    const grow = e.key === growKey;
    if (grow) setSnap(snap === 'closed' ? 'base' : 'expanded');
    else if (snap !== 'closed') setSnap(snap === 'expanded' ? 'base' : 'closed');
  };

  const open = snap !== 'closed' || dragPx !== null;
  const shown: SheetSnap = snap === 'closed' ? 'base' : snap;
  const size = !open ? undefined : (dragPx ?? `${FRACTION[orientation][shown] * 100}%`);

  return (
    <aside
      ref={root}
      aria-label={label}
      data-testid="mobile-sheet"
      data-hud="mobile-sheet"
      data-snap={snap}
      style={portrait ? { height: size } : { width: size }}
      className={`hud-card pointer-events-auto absolute z-30 flex ${
        portrait
          ? // Bottom reserve (4.5rem + inset): the dock row sits over it, so it stays reachable under the sheet (#25).
            // 4.5rem = 72 px: 44 px dock button + padding + offset; derived, aesthetic margin (not data).
            'inset-x-0 bottom-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
          : 'inset-y-0 right-0 max-w-[50vw] flex-row pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]'
      } ${dragPx === null ? 'motion-safe:transition-[height,width] motion-safe:duration-200' : ''}`}
    >
      <button
        type="button"
        aria-label={t('ui.sheetHandle')}
        data-testid="sheet-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        className={`flex flex-none items-center justify-center touch-none ${
          portrait ? 'h-11 w-full' : 'h-full w-11'
        }`}
      >
        <span
          aria-hidden
          className={`rounded-full bg-hud-muted ${portrait ? 'h-1 w-10' : 'h-10 w-1'}`}
        />
      </button>
      {open && (
        <div id={contentId} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      )}
    </aside>
  );
}
