import type { HTMLAttributes, ReactNode } from 'react';

/** HUD-styled panel: dark translucent card with border and inner glow. */
export function HudPanel({
  className = '',
  children,
  ...rest
}: {
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`hud-panel rounded-lg p-3 ${className}`} {...rest}>
      {children}
    </section>
  );
}
