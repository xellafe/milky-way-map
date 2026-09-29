import type { HTMLAttributes, ReactNode } from 'react';

/** HUD-styled panel: dark translucent card with border, inner glow and bracket corners. */
export function HudPanel({
  title,
  className = '',
  children,
  ...rest
}: {
  title?: string;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`hud-panel rounded-lg p-3 ${className}`} {...rest}>
      {title && <h2 className="mb-2 font-hud-mono text-xs text-hud-muted uppercase">{title}</h2>}
      {children}
    </section>
  );
}
