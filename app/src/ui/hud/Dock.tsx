import { useEffect, useRef, type ReactNode } from 'react';
import { useGalaxyMapStore, type DockPanelId } from '../../state/store';

export interface DockItem {
  id: DockPanelId;
  label: string;
  icon: ReactNode;
  testId: string;
  badge?: ReactNode;
  /** Marks the icon as part of the music zone (see MUSIC_SELECTOR). */
  musicZone?: boolean;
  content: ReactNode;
}

/**
 * Bottom control dock (#3): one row of icon buttons, at most one
 * panel open at a time (state lives in the store, shared with view changes
 * that must close it — see enterSystemView/exitSystemView).
 *
 * Esc closes the open panel and returns focus to its icon — but only while a
 * panel is open, and only for events not already handled elsewhere (checked
 * via defaultPrevented) so SearchBox's and LanguageSelector's own Escape
 * handling keeps working unchanged.
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
      const openId = dockPanel;
      closeDockPanel();
      buttonRefs.current.get(openId)?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dockPanel, closeDockPanel]);

  const activeItem = items.find((item) => item.id === dockPanel) ?? null;

  return (
    <>
      {activeItem && (
        // Above the dock, centered; each panel caps its own height (max-h).
        <div className="absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
          <div className="w-full max-w-md">{activeItem.content}</div>
        </div>
      )}
      <nav
        aria-label={label}
        className="hud-panel absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg px-2 py-2"
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
            aria-controls={`dock-panel-${item.id}`}
            aria-describedby={item.badge ? `dock-badge-${item.id}` : undefined}
            data-testid={item.testId}
            data-music-zone={item.musicZone ? '' : undefined}
            onClick={() => toggleDockPanel(item.id)}
            className="relative flex h-9 w-9 items-center justify-center rounded border border-hud-accent/30 bg-white/5 text-hud-text hover:bg-white/10"
          >
            {item.icon}
            {item.badge && (
              <span
                id={`dock-badge-${item.id}`}
                className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2"
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </>
  );
}
