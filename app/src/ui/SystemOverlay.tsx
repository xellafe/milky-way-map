import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getHost } from '../data/exoplanets';
import { classifyPlanet } from '../lib/planetType';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';
import { PlanetCard } from './PlanetCard';
import { PlanetList } from './PlanetList';
import { SystemStarPanel } from './SystemStarPanel';

/**
 * DOM overlay of the System View (SPEC §6.7): back to galaxy, host-star panel
 * (left), planet list (right, keyboard reachable, SPEC §6.9) and the planet
 * card. The time bar and the view controls live in BottomStack/DockPanel.
 */
export function SystemOverlay() {
  const { t } = useTranslation();
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const selectedPlanet = useGalaxyMapStore((s) => s.selectedPlanet);
  const exitSystemView = useGalaxyMapStore((s) => s.exitSystemView);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);

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

  return (
    <>
      <header
        data-hud="system-header"
        className="absolute top-4 left-4 z-10 flex items-center gap-3"
      >
        <HudButton variant="secondary" onClick={exitSystemView} data-testid="system-back">
          ← {t('system.back')}
        </HudButton>
        <h1 className="font-hud text-lg text-hud-bright" data-testid="system-title">
          {hostname}
        </h1>
      </header>

      <SystemStarPanel hostname={hostname} host={host} />
      <PlanetList planets={shownPlanets} />
      {planet && <PlanetCard key={planet.pl_name} planet={planet} />}
    </>
  );
}
