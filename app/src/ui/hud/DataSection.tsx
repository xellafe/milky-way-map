import type { ReactNode } from 'react';

/** Titled group of DataRow items. */
export function DataSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section aria-label={title} data-testid={testId} className="mt-2">
      <h4 className="hud-label">{title}</h4>
      <dl>{children}</dl>
    </section>
  );
}
