import type { ReactNode } from 'react';

const toneClass = {
  accent: 'border-hud-accent/50 text-hud-bright bg-hud-accent/10',
  warn: 'border-hud-warn/50 text-hud-warn bg-hud-warn/10',
};

/** Compact square label, used for badges like "N planets" or "estimate". */
export function Badge({
  tone = 'accent',
  children,
  ...rest
}: {
  tone?: 'accent' | 'warn';
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <span
      className={`inline-block rounded-hud border px-1.5 py-0.5 font-hud-mono text-xs ${toneClass[tone]}`}
      {...rest}
    >
      {children}
    </span>
  );
}
