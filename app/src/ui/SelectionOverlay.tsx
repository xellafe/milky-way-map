import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from '../lib/motion';
import { setSelectionAnchor } from '../scene/selectionAnchor';
import { useGalaxyMapStore } from '../state/store';
import { Badge } from './hud/Badge';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** B6 double ring + compact 4-value card that follows the selected star (#3).
 * Ring diameters (40/54 px), rotation periods (14 s / 8 s), lock (1 s) and
 * flicker (350 ms) are human design choices (#3 design spec §2), not data.
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
    if (!active || active === document.body || active.closest('[data-testid=selection-overlay]')) {
      document.querySelector<HTMLElement>('[data-testid=panel-close]')?.focus();
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
          className="absolute -top-[28px] -left-[28px] h-[56px] w-[56px] motion-safe:animate-[hud-lock_1s_ease-out]"
        >
          {/* Geometry of mockup B6. Inner ring Ø40: dash 40° / gap 5° / dot 5° /
              gap 10° (r=20: 13.96 1.75 1.75 3.49). Outer ring Ø54: dots 2° on /
              5° off (r=27: 0.94 2.36). fill-box: rotate around each circle's own
              centre (the viewBox origin), not the view-box centre. */}
          <svg viewBox="-28 -28 56 56" className="h-full w-full text-hud-accent">
            <g className="origin-center [transform-box:fill-box] motion-safe:animate-[hud-spin_14s_linear_infinite]">
              {/* Halo: a wide faint stroke, not a CSS drop-shadow (a filter on an
                  animated element is re-rasterized every frame). */}
              <circle
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                opacity="0.2"
                strokeDasharray="13.96 1.75 1.75 3.49"
              />
              <circle
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.85"
                strokeDasharray="13.96 1.75 1.75 3.49"
              />
            </g>
            <g className="origin-center [transform-box:fill-box] motion-safe:animate-[hud-spin-reverse_8s_linear_infinite]">
              <circle
                r="27"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.55"
                strokeDasharray="0.94 2.36"
              />
            </g>
          </svg>
        </div>
        {/* The card sits beside the centred star: pointer-events-none lets wheel
            and drag reach the canvas (orbit lock); only ✕ is interactive. */}
        <section
          data-testid="selection-card"
          aria-label={t('overlay.label')}
          className="hud-panel selection-card pointer-events-none absolute top-[-27px] w-56 rounded-lg p-2"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t('overlay.close')}
            data-testid="overlay-close"
            className="pointer-events-auto absolute top-1 right-1 rounded px-1.5 text-hud-muted hover:bg-white/10 hover:text-hud-bright"
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
