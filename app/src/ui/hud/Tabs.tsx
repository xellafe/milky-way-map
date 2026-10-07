import { useRef } from 'react';
import { nextTabIndex } from '../../lib/tabs';
import type { DockPanelId } from '../../state/store';

export interface TabItem {
  id: DockPanelId;
  label: string;
  testId: string;
}

/** Tablist of the dock panel; the single tabpanel is `#dock-panel`. */
export function Tabs({
  items,
  active,
  onSelect,
  label,
}: {
  items: TabItem[];
  active: DockPanelId;
  onSelect: (id: DockPanelId) => void;
  label: string;
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
            aria-controls="dock-panel"
            tabIndex={selected ? 0 : -1}
            data-testid={item.testId}
            onClick={() => onSelect(item.id)}
            className={`rounded-hud border px-2 py-1 font-hud text-xs ${
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
