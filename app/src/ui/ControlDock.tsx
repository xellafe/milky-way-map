import { useTranslation } from 'react-i18next';
import { isDefaultFilters } from '../lib/filterMask';
import { formatNumber } from '../lib/format';
import { isDefaultSettings, useSettingsStore } from '../state/settings';
import { useGalaxyMapStore, type DockPanelId } from '../state/store';
import { FiltersPanel } from './FiltersPanel';
import { Dock, type DockItem } from './hud/Dock';
import { HudButton } from './hud/HudButton';
import { HudCard } from './hud/HudCard';
import { HudSwitch } from './hud/HudInputs';
import { Tabs, type TabItem } from './hud/Tabs';
import { OptionsPanel } from './OptionsPanel';
import { SystemViewPanel } from './SystemViewPanel';
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
 * Bottom control dock (#3): one icon per panel; the galaxy view has Filters,
 * View and Options, the System View View and Options. The panel itself is
 * `DockPanel`, stacked above the bar by BottomStack.
 */
export function ControlDock() {
  const { t } = useTranslation();
  const view = useGalaxyMapStore((s) => s.view);
  const items: DockItem[] = [
    ...(view === 'galaxy'
      ? [
          {
            id: 'filters' as const,
            label: t('dock.filters'),
            icon: <FiltersIcon />,
            testId: 'filters-toggle',
          },
        ]
      : []),
    { id: 'view', label: t('dock.view'), icon: <ViewIcon />, testId: 'view-toggle' },
    { id: 'options', label: t('dock.options'), icon: <OptionsIcon />, testId: 'options-toggle' },
  ];
  return <Dock items={items} label={t('dock.label')} />;
}

/**
 * System View options (#23): only realism acts on the host star. The galaxy-only
 * settings are hidden, and so is the reset (it would also wipe them).
 */
function SystemOptions() {
  const { t } = useTranslation();
  const realism = useSettingsStore((s) => s.realism);
  const setSettings = useSettingsStore((s) => s.setSettings);
  return (
    <section
      id="dock-panel-options"
      aria-label={t('options.title')}
      data-testid="options-panel"
      className="text-sm"
    >
      <HudSwitch
        label={t('options.realism')}
        checked={realism}
        data-testid="option-realism"
        onChange={(e) => setSettings({ realism: e.target.checked })}
      />
    </section>
  );
}

/** Reset button of the active tab; the View tab and the System View options have nothing to reset. */
function ResetButton({ id }: { id: DockPanelId }) {
  const { t } = useTranslation();
  const filters = useGalaxyMapStore((s) => s.filters);
  const resetFilters = useGalaxyMapStore((s) => s.resetFilters);
  const settings = useSettingsStore();
  const view = useGalaxyMapStore((s) => s.view);
  if (id === 'view' || (id === 'options' && view === 'system')) return null;
  const isFilters = id === 'filters';
  return (
    <HudButton
      variant="secondary"
      onClick={isFilters ? resetFilters : settings.resetSettings}
      disabled={isFilters ? isDefaultFilters(filters) : isDefaultSettings(settings)}
      data-testid={isFilters ? 'filters-reset' : 'options-reset'}
      className="px-2 py-1 text-xs"
    >
      {t(isFilters ? 'filters.reset' : 'options.reset')}
    </HudButton>
  );
}

/** Single tabbed panel of the dock: header (tabs, visible count, reset) + active content. */
export function DockPanel() {
  const { t, i18n } = useTranslation();
  const view = useGalaxyMapStore((s) => s.view);
  const active = useGalaxyMapStore((s) => s.dockPanel);
  const toggleDockPanel = useGalaxyMapStore((s) => s.toggleDockPanel);
  const visibleCount = useGalaxyMapStore((s) => s.visibleCount);
  if (!active) return null;

  const tabs: TabItem[] = [
    ...(view === 'galaxy'
      ? [{ id: 'filters' as const, label: t('dock.filters'), testId: 'tab-filters' }]
      : []),
    { id: 'view', label: t('dock.view'), testId: 'tab-view' },
    { id: 'options', label: t('dock.options'), testId: 'tab-options' },
  ];
  // toggleDockPanel on an inactive tab opens it (and keeps the compact player rule, #13).
  const select = (id: DockPanelId) => id !== active && toggleDockPanel(id);

  return (
    <HudCard
      as="section"
      aria-label={t('dock.label')}
      data-testid="dock-panel"
      // 22rem = panel width: aesthetic choice (not data).
      className="pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tabs items={tabs} active={active} onSelect={select} label={t('dock.label')} />
        <div className="flex items-center gap-2">
          {view === 'galaxy' && visibleCount !== null && (
            <span
              className="font-hud-mono text-xs text-hud-muted"
              data-testid="visible-count"
              aria-label={t('dock.visibleCount', {
                value: formatNumber(visibleCount, i18n.language),
              })}
            >
              {formatNumber(visibleCount, i18n.language)}
            </span>
          )}
          <ResetButton id={active} />
        </div>
      </div>
      {/* max-h is an aesthetic choice (not data): leaves room for the time bar and dock. */}
      <div
        id="dock-panel"
        role="tabpanel"
        aria-labelledby={`dock-tab-${active}`}
        className="max-h-[50vh] overflow-y-auto"
      >
        {active === 'filters' && <FiltersPanel />}
        {active === 'view' && (view === 'galaxy' ? <ViewTogglesPanel /> : <SystemViewPanel />)}
        {active === 'options' && (view === 'galaxy' ? <OptionsPanel /> : <SystemOptions />)}
      </div>
    </HudCard>
  );
}
