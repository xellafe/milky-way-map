import { Fragment } from 'react';
import type { Tick } from '../../lib/gaugeScale';

// Spectral gradient: red (cool, left) to blue (hot, right). Aesthetic choice,
// not data: it hints at star colour, it does not encode a measurement.
const SPECTRAL_GRADIENT = 'linear-gradient(to right, #ff6b4a, #ffd27a, #f4f8ff, #7aa8ff)';

/** Horizontal 0..1 meter. A null position renders an empty track with no
 * marker and no aria-valuenow (missing data is never drawn, AGENTS rule 5). */
export function Gauge({
  position,
  variant = 'track',
  ticks = [],
  zones = [],
  fill = true,
  valueText,
  labelledBy,
}: {
  position: number | null;
  variant?: 'track' | 'spectral';
  ticks?: readonly Tick[];
  /** Highlighted ranges: `strong` is a framed box labelled above the track
   * (left-anchored), otherwise a thicker segment (label right-anchored). */
  zones?: readonly { from: number; to: number; label: string; strong: boolean }[];
  /** Fill the track from 0 to the marker; ignored for `spectral`. */
  fill?: boolean;
  valueText: string;
  /** id of the visible label element. */
  labelledBy: string;
}) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={position ?? undefined}
      aria-valuetext={valueText}
      aria-labelledby={labelledBy}
      // Sizes below (track 2 px, marker 2x12 px, zone box, offsets, label size) are
      // aesthetic choices, not data (#23).
      className={`relative ${zones.length ? 'mt-6' : 'mt-3'} h-0.5 w-full bg-hud-accent/25${ticks.some((t) => t.label) ? ' mb-3.5' : ''}`}
      style={variant === 'spectral' ? { backgroundImage: SPECTRAL_GRADIENT } : undefined}
    >
      {fill && variant === 'track' && position !== null && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-hud-accent"
          style={{ width: `${position * 100}%` }}
        />
      )}
      {zones.map((z) => (
        <Fragment key={z.from}>
          <span
            aria-hidden="true"
            className={`absolute ${z.strong ? '-top-1.5 h-3.5 border border-hud-accent/70 bg-hud-accent/15' : '-top-px h-1 bg-hud-accent/60'}`}
            style={{ left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%` }}
          />
          <span
            aria-hidden="true"
            data-gauge-label="zone"
            className={`absolute -top-5 whitespace-nowrap text-[9px] leading-none text-hud-muted${z.strong ? ' ml-1' : ' -translate-x-full'}`}
            style={{ left: `${(z.strong ? z.from : z.to) * 100}%` }}
          >
            {z.label}
          </span>
        </Fragment>
      ))}
      {ticks.map((t) => (
        <Fragment key={t.at}>
          {t.mark && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 h-2.5 w-px bg-hud-muted"
              style={{ left: `${t.at * 100}%` }}
            />
          )}
          {t.label && (
            <span
              aria-hidden="true"
              data-gauge-label="tick"
              // Edge labels are anchored inward so they never overflow the tile.
              className={`absolute top-3 whitespace-nowrap text-[9px] leading-none text-hud-muted${
                t.at === 0 ? '' : t.at === 1 ? ' -translate-x-full' : ' -translate-x-1/2'
              }`}
              style={{ left: `${t.at * 100}%` }}
            >
              {t.label}
            </span>
          )}
        </Fragment>
      ))}
      {position !== null && (
        <span
          aria-hidden="true"
          data-testid="gauge-marker"
          className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-hud-bright shadow-[0_0_6px_var(--color-hud-accent)]"
          style={{ left: `${position * 100}%` }}
        />
      )}
    </div>
  );
}
