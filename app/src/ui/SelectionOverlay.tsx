import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from '../lib/motion';
import {
  CALLOUT_PATH,
  CARD_GAP_PX,
  CARD_TOP_OFFSET_PX,
  INNER_DASH,
  INNER_R,
  OUTER_DASH,
  OUTER_R,
  RING_HALF_PX,
} from '../lib/selectionGeometry';
import { setSelectionAnchor } from '../scene/selectionAnchor';
import { useGalaxyMapStore } from '../state/store';
import { Badge } from './hud/Badge';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** B6 double ring + compact 4-value card that follows the selected star (#3).
 * Ring diameters (60/94.5 px, lib/selectionGeometry), rotation periods
 * (14 s / 8 s), lock (1 s) and flicker (350 ms) are human design choices (#3 design spec §2), not data.
 * Position is written by SelectionTracker. */
function Overlay({ index }: { index: number }) {
  const { t } = useTranslation();
  const { host } = useStarHost(index);
  const [closing, setClosing] = useState(false);
  const { title } = useStarTitle(index);

  // Closing hides the overlay; focus moves to the panel's own ✕ so keyboard
  // users do not fall back to the document start.
  const finish = () => {
    useGalaxyMapStore.getState().closeSelectionOverlay();
    // Only if focus was lost with the overlay or never left the page body.
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('[data-hud=selection-overlay]')) {
      document.querySelector<HTMLElement>('[data-hud=panel-close]')?.focus();
    }
  };
  const close = () => {
    if (prefersReducedMotion()) finish();
    else setClosing(true);
  };

  return (
    <div
      ref={setSelectionAnchor}
      data-testid="selection-overlay"
      data-hud="selection-overlay"
      className="pointer-events-none invisible absolute top-0 left-0 z-10 h-0 w-0"
    >
      <div
        className={closing ? 'motion-safe:animate-[hud-flicker_350ms_steps(1)_forwards]' : ''}
        onAnimationEnd={(e) => {
          if (e.animationName === 'hud-flicker') finish();
        }}
      >
        <div
          aria-hidden
          data-hud="selection-ring"
          style={{
            top: -RING_HALF_PX,
            left: -RING_HALF_PX,
            width: 2 * RING_HALF_PX,
            height: 2 * RING_HALF_PX,
          }}
          className="absolute motion-safe:animate-[hud-lock_1s_ease-out]"
        >
          {/* Geometry of mockup B6 (patterns in lib/selectionGeometry). fill-box:
              rotate around each circle's own centre (the viewBox origin), not the
              view-box centre. */}
          <svg
            viewBox={`${-RING_HALF_PX} ${-RING_HALF_PX} ${2 * RING_HALF_PX} ${2 * RING_HALF_PX}`}
            className="h-full w-full text-hud-accent"
          >
            <g className="origin-center [transform-box:fill-box] motion-safe:animate-[hud-spin_14s_linear_infinite]">
              {/* Halo: a wide faint stroke, not a CSS drop-shadow (a filter on an
                  animated element is re-rasterized every frame). */}
              <circle
                r={INNER_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                opacity="0.2"
                strokeDasharray={INNER_DASH}
              />
              <circle
                r={INNER_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.85"
                strokeDasharray={INNER_DASH}
              />
            </g>
            <g className="origin-center [transform-box:fill-box] motion-safe:animate-[hud-spin-reverse_8s_linear_infinite]">
              <circle
                r={OUTER_R}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.55"
                strokeDasharray={OUTER_DASH}
              />
            </g>
          </svg>
        </div>
        {/* Static leader (star → card). A zero-size box at the star, so the lock
            animation scales it about the same centre as the rings. */}
        <div
          aria-hidden
          className="absolute top-0 left-0 motion-safe:animate-[hud-lock_1s_ease-out]"
        >
          <svg width="1" height="1" className="selection-callout overflow-visible text-hud-accent">
            <path
              data-hud="callout"
              d={CALLOUT_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.85"
            />
          </svg>
        </div>
        {/* The card blocks the pointer: UI must not let hover, click or wheel
            reach the stars drawn behind it. */}
        <section
          data-testid="selection-card"
          data-hud="selection-card"
          aria-label={t('overlay.label')}
          style={{ top: CARD_TOP_OFFSET_PX, '--card-gap': `${CARD_GAP_PX}px` } as CSSProperties}
          className="hud-panel selection-card pointer-events-auto absolute w-56 rounded-lg p-2"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t('overlay.close')}
            data-testid="overlay-close"
            className="absolute top-1 right-1 rounded px-1.5 text-hud-muted hover:bg-white/10 hover:text-hud-bright"
          >
            ✕
          </button>
          <h3 className="mb-2 pr-6 font-hud text-sm text-hud-bright">{title}</h3>
          <StarStatTiles index={index} compact />
          {host && (
            <p className="mt-2">
              <Badge data-testid="overlay-planets-badge">
                {t('panel.planetsCount', { count: host.planets.length })}
              </Badge>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function SelectionOverlay() {
  const index = useGalaxyMapStore((s) =>
    s.view === 'galaxy' && s.selectionOverlayOpen && s.selection?.kind === 'star'
      ? s.selection.index
      : null,
  );
  const epoch = useGalaxyMapStore((s) => s.selectionEpoch);
  // key: every selection (also of the same star) remounts, restarting the lock
  // animation and resetting `closing`: a click during the flicker reopens.
  return index === null ? null : <Overlay key={`${index}:${epoch}`} index={index} />;
}
