import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getNamesEntry } from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
import { FLAG_HAS_EXOPLANETS, hasFlag, spectralClassLetter } from '../lib/format';
import { setSelectionAnchor } from '../scene/selectionAnchor';
import { useGalaxyMapStore } from '../state/store';
import { AnchoredCard } from './hud/AnchoredCard';
import { Badge } from './hud/Badge';
import { ObjectCard } from './hud/ObjectCard';
import { ArchiveSection, CatalogSection, StarExtraRows, ViewSystemButton } from './StarDetails';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** The single star card (#23): Base/Advanced, anchored to the selected star. */
function StarCard({ index }: { index: number }) {
  const { t } = useTranslation();
  const { host } = useStarHost(index);
  const { title } = useStarTitle(index);
  const entry = getNamesEntry(index);
  const core = getStarCore();
  const hasExo = hasFlag(core?.flags[index] ?? 0, FLAG_HAS_EXOPLANETS);
  const spectral = spectralClassLetter(core?.spectralClass[index] ?? 7);

  return (
    <AnchoredCard
      anchorRef={setSelectionAnchor}
      anchored
      card={
        <ObjectCard
          testId="selection-card"
          titleTestId="panel-title"
          closeTestId="overlay-close"
          title={title}
          onClose={() => useGalaxyMapStore.getState().selectStar(null)}
          subtitle={
            <span className="flex items-center gap-2">
              {entry?.constellation && <span>{entry.constellation}</span>}
              <span className="sr-only">{t('panel.spectralClass')}</span>
              <Badge>{spectral ?? t('panel.na')}</Badge>
            </span>
          }
          base={<StarStatTiles index={index} compact />}
          footer={hasExo ? <ViewSystemButton index={index} /> : undefined}
          advanced={
            <>
              <StarExtraRows index={index} />
              <CatalogSection index={index} />
              {host && <ArchiveSection host={host} withAge={false} />}
            </>
          }
        />
      }
    />
  );
}

export function SelectionOverlay() {
  const index = useGalaxyMapStore((s) =>
    s.view === 'galaxy' && s.selection ? s.selection.index : null,
  );
  const epoch = useGalaxyMapStore((s) => s.selectionEpoch);

  // Esc deselects, unless something else already used it: a dock panel (marks the
  // event handled), the search box or a dialog.
  useEffect(() => {
    if (index === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('dialog')) return;
      if (useGalaxyMapStore.getState().dockPanel) return;
      useGalaxyMapStore.getState().selectStar(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index]);

  // key: every selection (also of the same star) remounts, restarting the opening sequence.
  return index === null ? null : <StarCard key={`${index}:${epoch}`} index={index} />;
}
