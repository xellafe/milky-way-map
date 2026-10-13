import type { ButtonHTMLAttributes, Ref } from 'react';

const variantClass = {
  primary: 'bg-hud-accent/20 text-hud-bright border-hud-accent/60 hover:bg-hud-accent/30',
  secondary: 'bg-white/5 text-hud-text border-hud-accent/30 hover:bg-white/10',
};

/**
 * HUD-styled button, primary or secondary. Plain function component: React 19
 * passes `ref` as a normal prop, no `forwardRef` needed.
 */
export function HudButton({
  variant = 'primary',
  className = '',
  touch = false,
  ref,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  /** 44x44 px minimum (phone, #25); a prop because a className cannot override the size. */
  touch?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`rounded-hud border px-3 py-1.5 font-hud text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${touch ? 'min-h-11 min-w-11' : ''} ${variantClass[variant]} ${className}`}
      {...rest}
    />
  );
}
