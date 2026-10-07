import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getHost } from '../data/exoplanets';
import { classifyPlanet } from '../lib/planetType';
import { useGalaxyMapStore } from '../state/store';
import { Badge } from './hud/Badge';
import { HudButton } from './hud/HudButton';
import { HudCard } from './hud/HudCard';
import { PlanetCard } from './PlanetCard';

/**
 * DOM overlay of the System View (SPEC §6.7): back to galaxy, planet list +
 * details (keyboard reachable, SPEC §6.9) and the real-scale disclaimer. The
 * time bar and the view controls live in BottomStack/DockPanel.
 */
export function SystemOverlay() {
  const { t } = useTranslation();
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const selectedPlanet = useGalaxyMapStore((s) => s.selectedPlanet);
  const selectPlanet = useGalaxyMapStore((s) => s.selectPlanet);
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
        {/* Deliberate simplification: badge in the header; upgrade when the System View star panel exists (#23). */}
        {!host.starRef.matched && (
          <Badge tone="warn" data-testid="not-anchored-badge">
            {t('panel.notAnchored')}
          </Badge>
        )}
      </header>

      {/*
       * Right panels end 1rem above the expanded music player: max-h is an
       * aesthetic choice (not data), in rem. Panel top is 4rem; the player is
       * 3.5rem tall (measured). Below lg it sits at bottom-20: 4 + 5 + 3.5 + 1 =
       * 13.5rem. From lg at bottom-4: 4 + 1 + 3.5 + 1 = 9.5rem.
       */}
      <HudCard
        as="aside"
        data-hud="side-panel-right"
        aria-label={t('system.planets')}
        className="absolute top-16 right-4 z-10 max-h-[calc(100%-13.5rem)] lg:max-h-[calc(100%-9.5rem)] w-80 overflow-y-auto p-4"
      >
        <p className="mb-2 text-sm text-hud-muted">{t('system.planets')}</p>
        <div className="flex flex-wrap gap-1">
          {shownPlanets.map((p) => (
            <button
              key={p.pl_name}
              type="button"
              data-testid="planet-chip"
              aria-pressed={selectedPlanet === p.pl_name}
              onClick={() =>
                selectPlanet(
                  selectedPlanet === p.pl_name
                    ? null
                    : { name: p.pl_name, type: classifyPlanet(p) },
                )
              }
              className={`rounded-hud border px-2 py-1 font-hud text-xs ${
                selectedPlanet === p.pl_name
                  ? 'border-hud-accent/60 bg-hud-accent/20 text-hud-bright'
                  : 'border-hud-accent/30 bg-white/5 text-hud-text hover:bg-white/10'
              }`}
            >
              {p.pl_name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-hud-muted">{t('system.scaleNote')}</p>
      </HudCard>
      {planet && <PlanetCard key={planet.pl_name} planet={planet} />}
    </>
  );
}
