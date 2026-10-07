import type { HTMLAttributes } from 'react';

/** HUD card: translucent, blurred, square, with corner brackets (.hud-card, #23). */
export function HudCard({
  as: Tag = 'div',
  className = '',
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'aside' | 'nav' | 'header' }) {
  return <Tag data-hud-card className={`hud-card ${className}`} {...rest} />;
}
