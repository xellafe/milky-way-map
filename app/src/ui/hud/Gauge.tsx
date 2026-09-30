// Spectral gradient: red (cool, left) to blue (hot, right). Aesthetic choice,
// not data: it hints at star colour, it does not encode a measurement.
const SPECTRAL_GRADIENT = 'linear-gradient(to right, #ff6b4a, #ffd27a, #f4f8ff, #7aa8ff)';

/** Horizontal 0..1 meter. A null position renders an empty track with no
 * marker and no aria-valuenow (missing data is never drawn, AGENTS rule 5). */
export function Gauge({
  position,
  variant = 'track',
  tick,
  tickLabel,
  valueText,
  labelledBy,
}: {
  position: number | null;
  variant?: 'track' | 'spectral';
  tick?: number;
  tickLabel?: string;
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
      className={`relative mt-1 h-1.5 w-full rounded-full bg-hud-accent/20${tickLabel ? ' mb-3.5' : ''}`}
      style={variant === 'spectral' ? { backgroundImage: SPECTRAL_GRADIENT } : undefined}
    >
      {tick !== undefined && (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-0.5 h-2.5 w-px bg-hud-muted"
            style={{ left: `${tick * 100}%` }}
          />
          {tickLabel && (
            <span
              aria-hidden="true"
              className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-[9px] leading-none text-hud-muted"
              style={{ left: `${tick * 100}%` }}
            >
              {tickLabel}
            </span>
          )}
        </>
      )}
      {position !== null && (
        <span
          aria-hidden="true"
          data-testid="gauge-marker"
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hud-bg bg-hud-bright shadow-[0_0_6px_var(--color-hud-accent)]"
          style={{ left: `${position * 100}%` }}
        />
      )}
    </div>
  );
}
