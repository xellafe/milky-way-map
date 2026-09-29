import type { ButtonHTMLAttributes } from 'react';

const variantClass = {
  primary: 'bg-hud-accent/20 text-hud-bright border-hud-accent/60 hover:bg-hud-accent/30',
  secondary: 'bg-white/5 text-hud-text border-hud-accent/30 hover:bg-white/10',
};

/** HUD-styled button, primary or secondary. */
export function HudButton({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      type="button"
      className={`rounded border px-3 py-1.5 font-hud text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantClass[variant]} ${className}`}
      {...rest}
    />
  );
}
