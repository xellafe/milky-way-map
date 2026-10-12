import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHost } from '../data/exoplanets';
import { classifyPlanet } from '../lib/planetType';
import { sheetContent } from '../lib/sheet';
import { useLayoutMode } from '../lib/viewport';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';
import { Tabs } from './hud/Tabs';
import { MobileSheet } from './MobileSheet';
import { PlanetCard } from './PlanetCard';
import { PlanetList } from './PlanetList';
import { SystemStarPanel } from './SystemStarPanel';

/**
 * DOM overlay of the System View (SPEC §6.7): back to galaxy, host-star panel
 * (left), planet list (right, keyboard reachable, SPEC §6.9) and the planet
 * card. The time bar and the view controls live in BottomStack/DockPanel.
 * Phone (#25): the two panels (as tabs) and the planet card share the single sheet.
 */
export function SystemOverlay() {
  const { t } = useTranslation();
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const selectedPlanet = useGalaxyMapStore((s) => s.selectedPlanet);
  const exitSystemView = useGalaxyMapStore((s) => s.exitSystemView);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);
  const dockPanel = useGalaxyMapStore((s) => s.dockPanel);
  const musicExpanded = useGalaxyMapStore((s) => s.musicExpanded);
  const layout = useLayoutMode();
  const mobile = layout !== 'desktop';
  const [tab, setTab] = useState<'star' | 'planets'>('star');

  // Esc deselects the planet unless something else used it: a dock panel (marks
  // the event handled), the search box or a dialog.
  useEffect(() => {
    if (selectedPlanet === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('dialog')) return;
      if (useGalaxyMapStore.getState().dockPanel) return;
      useGalaxyMapStore.getState().selectPlanet(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPlanet]);

  const host = hostname ? getHost(hostname) : null;
  if (!hostname || !host) return null;
  const shownPlanets = host.planets.filter((p) => visibleTypes[classifyPlanet(p)]);
  const planet = shownPlanets.find((p) => p.pl_name === selectedPlanet) ?? null;

  const header = (
    <header
      data-hud="system-header"
      // Phone: the top row is shared with help and language (8rem on the right; in
      // landscape the sheet also takes the right half), so a long host name truncates.
      // z-50 on the phone: the full-width top bar (z-40) would otherwise cover the back button.
      className={
        mobile
          ? `absolute top-[max(0.5rem,env(safe-area-inset-top))] left-2 z-50 flex items-center gap-2 ${
              layout === 'landscape' ? 'right-[calc(50vw+8rem)]' : 'right-32'
            }`
          : 'absolute top-4 left-4 z-10 flex items-center gap-3'
      }
    >
      <HudButton
        variant="secondary"
        touch={mobile}
        onClick={exitSystemView}
        data-testid="system-back"
        className="shrink-0"
      >
        ← {t('system.back')}
      </HudButton>
      <h1 className="min-w-0 truncate font-hud text-lg text-hud-bright" data-testid="system-title">
        {hostname}
      </h1>
    </header>
  );

  if (!mobile) {
    return (
      <>
        {header}
        <SystemStarPanel hostname={hostname} host={host} />
        <PlanetList planets={shownPlanets} />
        {planet && <PlanetCard key={planet.pl_name} planet={planet} />}
      </>
    );
  }

  // An open dock panel or the player takes the sheet over (BottomStack / MusicPlayer render it).
  const content = sheetContent({
    view: 'system',
    hasStar: false,
    hasPlanet: planet !== null,
    dockPanel,
    musicExpanded,
  });
  return (
    <>
      {header}
      {content === 'planet' && planet && (
        <MobileSheet label={planet.pl_name}>
          <PlanetCard
            key={planet.pl_name}
            planet={planet}
            sheet
            onClose={() => {
              useGalaxyMapStore.getState().selectPlanet(null);
              setTab('planets');
            }}
          />
        </MobileSheet>
      )}
      {content === 'system' && (
        <MobileSheet label={hostname}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <Tabs
              items={[
                { id: 'star', label: t('system.tabStar'), testId: 'sheet-tab-star' },
                {
                  id: 'planets',
                  label: t('system.tabPlanets', { count: shownPlanets.length }),
                  testId: 'sheet-tab-planets',
                },
              ]}
              active={tab}
              onSelect={setTab}
              label={t('system.sheetTabs')}
              panelId="system-sheet-panel"
              touch
            />
            <div
              id="system-sheet-panel"
              role="tabpanel"
              aria-labelledby={`dock-tab-${tab}`}
              // Scrollable: needs keyboard access (axe scrollable-region-focusable).
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {tab === 'star' ? (
                <SystemStarPanel hostname={hostname} host={host} sheet />
              ) : (
                <PlanetList planets={shownPlanets} sheet />
              )}
            </div>
          </div>
        </MobileSheet>
      )}
    </>
  );
}
