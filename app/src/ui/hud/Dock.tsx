import { useEffect, useRef, type ReactNode } from 'react';
import { useGalaxyMapStore, type DockPanelId } from '../../state/store';
import { HudCard } from './HudCard';

export interface DockItem {
  id: DockPanelId;
  label: string;
  icon: ReactNode;
  testId: string;
}

/**
 * Bottom control dock (#3): one row of icon buttons, at most one
 * panel open at a time (state lives in the store, shared with view changes
 * that must close it — see enterSystemView/exitSystemView).
 *
 * Esc closes the open panel and returns focus to its icon — but only while a
 * panel is open, and only for events not already handled elsewhere (checked
 * via defaultPrevented) so SearchBox's and LanguageSelector's own Escape
 * handling keeps working unchanged. It marks the event handled so later Esc
 * handlers (star deselect) skip it.
 */
export function Dock({ items, label }: { items: DockItem[]; label: string }) {
  const dockPanel = useGalaxyMapStore((s) => s.dockPanel);
  const toggleDockPanel = useGalaxyMapStore((s) => s.toggleDockPanel);
  const closeDockPanel = useGalaxyMapStore((s) => s.closeDockPanel);
  const buttonRefs = useRef(new Map<DockPanelId, HTMLButtonElement | null>());

  useEffect(() => {
    if (!dockPanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // Escape inside the welcome dialog closes only the dialog (#12).
      if (event.target instanceof Element && event.target.closest('dialog')) return;
      const openId = dockPanel;
      event.preventDefault();
      closeDockPanel();
      buttonRefs.current.get(openId)?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dockPanel, closeDockPanel]);

  return (
    <HudCard
      as="nav"
      aria-label={label}
      data-testid="dock"
      data-hud="dock"
      className="pointer-events-auto flex items-center gap-2 px-2 py-2"
    >
      {items.map((item) => (
        <button
          key={item.id}
          ref={(el) => {
            buttonRefs.current.set(item.id, el);
          }}
          type="button"
          aria-label={item.label}
          aria-expanded={dockPanel === item.id}
          aria-controls="dock-panel"
          data-testid={item.testId}
          onClick={() => toggleDockPanel(item.id)}
          className="relative flex h-9 w-9 items-center justify-center rounded-hud border border-hud-accent/30 bg-white/5 text-hud-text hover:bg-white/10"
        >
          {item.icon}
        </button>
      ))}
    </HudCard>
  );
}
