import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/**
 * Switch drawn by CSS (.hud-switch). The real input sits over the track with
 * opacity 0 — not sr-only — so it still receives clicks and keyboard focus.
 */
export function HudSwitch({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`flex items-center gap-2 font-hud text-sm text-hud-text ${className}`}>
      <span className="hud-switch">
        <input type="checkbox" role="switch" {...rest} />
        <span className="hud-switch-track" aria-hidden />
      </span>
      {label}
    </label>
  );
}

/**
 * Range input styled by .hud-range. No default width utility: a caller's width
 * override (`w-20`, `flex-1`, …) would conflict with a baked-in `w-full` at the
 * same specificity, resolved by stylesheet order rather than by which one is
 * passed last — so every caller sets its own width instead.
 */
export function HudSlider({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={`hud-range ${className}`} {...rest} />;
}

/** Select styled by .hud-select (custom arrow). */
export function HudSelect({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`hud-select ${className}`} {...rest} />;
}
