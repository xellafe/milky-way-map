import { useTranslation } from 'react-i18next';
import type { ExoplanetRecord } from '../data/exoplanets';
import { classifyPlanet } from '../lib/planetType';
import { useGalaxyMapStore } from '../state/store';
import { HudCard } from './hud/HudCard';
import { SIDE_PANEL_CLASS } from './sidePanel';

/** Right panel of the System View: one button row per visible planet (SPEC §6.7). */
export function PlanetList({ planets }: { planets: readonly ExoplanetRecord[] }) {
  const { t } = useTranslation();
  const selectedPlanet = useGalaxyMapStore((s) => s.selectedPlanet);
  const selectPlanet = useGalaxyMapStore((s) => s.selectPlanet);
  return (
    <HudCard
      as="aside"
      data-hud="side-panel-right"
      data-testid="planet-list"
      aria-label={t('system.planetList')}
      className={`${SIDE_PANEL_CLASS} right-4`}
    >
      <p className="mb-2 text-sm text-hud-muted">{t('system.planets')}</p>
      <div className="flex flex-col gap-1">
        {planets.map((p) => {
          const type = classifyPlanet(p);
          const selected = selectedPlanet === p.pl_name;
          return (
            <button
              key={p.pl_name}
              type="button"
              data-testid="planet-chip"
              aria-pressed={selected}
              onClick={() => selectPlanet(selected ? null : { name: p.pl_name, type })}
              className={`flex items-center justify-between gap-2 rounded-hud border px-2 py-1 text-left font-hud text-xs ${
                selected
                  ? 'border-hud-accent/60 bg-hud-accent/20 text-hud-bright'
                  : 'border-hud-accent/30 bg-white/5 text-hud-text hover:bg-white/10'
              }`}
            >
              <span>{p.pl_name}</span>
              <span className="text-hud-muted">{t(`planetType.${type}`)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-hud-muted">{t('system.scaleNote')}</p>
    </HudCard>
  );
}
