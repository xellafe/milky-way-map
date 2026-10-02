import type { HTMLAttributes, ReactNode } from 'react';

/** HUD-styled panel: dark translucent card with border and inner glow. */
export function HudPanel({
  className = '',
  padding = 'p-3',
  children,
  ...rest
}: {
  className?: string;
  /** Padding utilities; a prop because a className padding would not beat the default (equal specificity). */
  padding?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`hud-panel rounded-hud ${padding} ${className}`} {...rest}>
      {children}
    </section>
  );
}
