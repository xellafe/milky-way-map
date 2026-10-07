import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/** Native checkbox with HUD accent styling and a label. */
export function HudCheckbox({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={`flex items-center gap-2 font-hud text-sm text-hud-text ${className}`}>
      <input type="checkbox" className="accent-hud-accent" {...rest} />
      {label}
    </label>
  );
}

/**
 * Native range input with HUD accent styling. No default width utility: a
 * caller's width override (`w-20`, `flex-1`, …) would conflict with a baked-in
 * `w-full` at the same specificity, resolved by stylesheet order rather than
 * by which one is passed last — so every caller sets its own width instead.
 */
export function HudSlider({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="range" className={`accent-hud-accent ${className}`} {...rest} />;
}

/** Native select with HUD styling. */
export function HudSelect({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-hud border border-hud-accent/30 bg-black/40 px-2 py-1 font-hud text-sm text-hud-text ${className}`}
      {...rest}
    />
  );
}
