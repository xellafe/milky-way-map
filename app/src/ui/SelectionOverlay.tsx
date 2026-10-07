import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from '../lib/motion';
import {
  CALLOUT_OPACITY,
  CALLOUT_PATH,
  CALLOUT_STROKE_PX,
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
import { CloseButton } from './hud/CloseButton';
import { HudCard } from './hud/HudCard';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** B6 double ring + compact 4-value card that follows the selected star (#3).
 * Ring diameters (60/94.5 px, lib/selectionGeometry), rotation periods
 * (14 s / 8 s), opening sequence (lock 600 ms, callout draw 300 ms at 450 ms, card
 * unfold 250 ms at 700 ms) and flicker (350 ms) are human design choices (#3 design
 * spec §2), not data. Position is written by SelectionTracker. */
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
          className="absolute motion-safe:animate-[hud-lock_600ms_ease-out]"
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
        {/* Leader (star → card), drawn as the ring locks. */}
        <div aria-hidden className="absolute top-0 left-0">
          <svg width="1" height="1" className="selection-callout overflow-visible text-hud-accent">
            <path
              data-hud="callout"
              pathLength="1"
              strokeDasharray="1"
              className="motion-safe:animate-[hud-draw_300ms_ease-out_450ms_backwards]"
              d={CALLOUT_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth={CALLOUT_STROKE_PX}
              opacity={CALLOUT_OPACITY}
            />
          </svg>
        </div>
        {/* The card blocks the pointer: UI must not let hover, click or wheel
            reach the stars drawn behind it. */}
        <HudCard
          as="section"
          data-testid="selection-card"
          data-hud="selection-card"
          aria-label={t('overlay.label')}
          style={
            {
              top: CARD_TOP_OFFSET_PX,
              '--card-gap': `${CARD_GAP_PX}px`,
              '--card-stroke': `${CALLOUT_STROKE_PX}px`,
              '--card-stroke-alpha': `${CALLOUT_OPACITY * 100}%`,
            } as CSSProperties
          }
          className="selection-card pointer-events-auto absolute w-56 motion-safe:animate-[hud-unfold_250ms_ease-out_700ms_backwards] p-2"
        >
          <CloseButton onClick={close} label={t('overlay.close')} testId="overlay-close" />
          <h3 className="mb-2 pr-6 font-hud text-sm text-hud-bright">{title}</h3>
          <StarStatTiles index={index} compact />
          {host && (
            <p className="mt-2">
              <Badge data-testid="overlay-planets-badge">
                {t('panel.planetsCount', { count: host.planets.length })}
              </Badge>
            </p>
          )}
        </HudCard>
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
  // key: every selection (also of the same star) remounts, restarting the opening
  // sequence and resetting `closing`: a click during the flicker reopens.
  return index === null ? null : <Overlay key={`${index}:${epoch}`} index={index} />;
}
