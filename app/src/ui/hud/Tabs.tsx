import { useRef } from 'react';
import { nextTabIndex } from '../../lib/tabs';
import type { DockPanelId } from '../../state/store';

export interface TabItem<T extends string = DockPanelId> {
  id: T;
  label: string;
  testId: string;
}

/** Tablist of the dock panel; the single tabpanel is `#dock-panel` unless `panelId` says otherwise. */
export function Tabs<T extends string = DockPanelId>({
  items,
  active,
  onSelect,
  label,
  touch = false,
  panelId = 'dock-panel',
}: {
  items: TabItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  label: string;
  /** DOM id of the tabpanel the tabs control. */
  panelId?: string;
  /** 44 px high tabs (phone, #25). */
  touch?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const current = items.findIndex((item) => item.id === active);
    const next = nextTabIndex(current, event.key, items.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(items[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1">
      {items.map((item, i) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`dock-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            data-testid={item.testId}
            onClick={() => onSelect(item.id)}
            className={`rounded-hud border px-2 py-1 font-hud text-xs ${touch ? 'min-h-11 min-w-11' : ''} ${
              selected
                ? 'border-hud-accent/60 bg-hud-accent/20 text-hud-bright'
                : 'border-transparent text-hud-muted hover:text-hud-bright'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
