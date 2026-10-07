import type { CSSProperties, ReactNode } from 'react';
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
} from '../../lib/selectionGeometry';

/** B6 double ring + leader + card that follow an anchor (#3). The anchor's
 * position is written by SelectionTracker. Ring diameters (60/94.5 px,
 * lib/selectionGeometry), rotation periods (14 s / 8 s), opening sequence (lock
 * 600 ms, callout draw 300 ms at 450 ms, card unfold 250 ms at 700 ms) are human
 * design choices (#3 design spec §2), not data. `anchored === false` shows the
 * card alone, without ring or leader. */
export function AnchoredCard({
  anchorRef,
  anchored,
  card,
}: {
  anchorRef: (el: HTMLElement | null) => void;
  anchored: boolean;
  card: ReactNode;
}) {
  return (
    <div
      ref={anchorRef}
      data-testid="selection-overlay"
      data-hud="selection-overlay"
      className="pointer-events-none invisible absolute top-0 left-0 z-10 h-0 w-0"
    >
      <div>
        {anchored && (
          <>
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
              <svg
                width="1"
                height="1"
                className="selection-callout overflow-visible text-hud-accent"
              >
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
          </>
        )}

        {/* The card blocks the pointer: UI must not let hover, click or wheel
            reach the stars drawn behind it. The slot carries side, vertical
            shift (SelectionTracker) and the unfold. */}
        <div
          data-hud="selection-slot"
          style={
            {
              top: CARD_TOP_OFFSET_PX,
              '--card-gap': `${CARD_GAP_PX}px`,
              '--card-stroke': `${CALLOUT_STROKE_PX}px`,
              '--card-stroke-alpha': `${CALLOUT_OPACITY * 100}%`,
            } as CSSProperties
          }
          className="selection-slot absolute"
        >
          {card}
        </div>
      </div>
    </div>
  );
}
