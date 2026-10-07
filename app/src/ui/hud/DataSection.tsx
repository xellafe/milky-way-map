import type { ReactNode } from 'react';

/** Titled group of DataRow items (`list`), or of arbitrary controls (a `<dl>` may only hold dt/dd, axe). */
export function DataSection({
  title,
  children,
  testId,
  list = true,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
  list?: boolean;
}) {
  return (
    <section aria-label={title} data-testid={testId} className="mt-2">
      <h4 className="hud-label">{title}</h4>
      {list ? <dl>{children}</dl> : <div>{children}</div>}
    </section>
  );
}
