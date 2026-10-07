import { useTranslation } from 'react-i18next';
import { formatNumber } from '../lib/format';
import { useGalaxyMapStore } from '../state/store';
import { FiltersPanel } from './FiltersPanel';
import { Dock, type DockItem } from './hud/Dock';
import { OptionsPanel } from './OptionsPanel';
import { ViewTogglesPanel } from './ViewTogglesPanel';

function FiltersIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16M7 12h10M10 19h4"
      />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth="1.6" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth="1.6" />
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.5-7.5-2.1 2.1M8.6 15.4l-2.1 2.1m0-11 2.1 2.1m8.8 8.8 2.1 2.1"
      />
    </svg>
  );
}

/**
 * Bottom control dock (#3): gathers Filters/View/Options into one icon row,
 * one panel open at a time. The galaxy view shows all three, the System View
 * only Options.
 */
export function ControlDock() {
  const { t, i18n } = useTranslation();
  const view = useGalaxyMapStore((s) => s.view);
  const visibleCount = useGalaxyMapStore((s) => s.visibleCount);

  const optionsItem: DockItem = {
    id: 'options',
    label: t('dock.options'),
    icon: <OptionsIcon />,
    testId: 'options-toggle',
    content: <OptionsPanel />,
  };

  const items: DockItem[] =
    view === 'galaxy'
      ? [
          {
            id: 'filters',
            label: t('dock.filters'),
            icon: <FiltersIcon />,
            testId: 'filters-toggle',
            badge:
              visibleCount !== null ? (
                <span
                  className="rounded-hud border border-hud-accent/40 bg-black/70 px-1 font-hud-mono text-[10px] text-hud-muted"
                  data-testid="visible-count"
                >
                  {formatNumber(visibleCount, i18n.language)}
                </span>
              ) : undefined,
            content: <FiltersPanel />,
          },
          {
            id: 'view',
            label: t('dock.view'),
            icon: <ViewIcon />,
            testId: 'view-toggle',
            content: <ViewTogglesPanel />,
          },
          optionsItem,
        ]
      : [optionsItem];

  return <Dock items={items} label={t('dock.label')} />;
}
