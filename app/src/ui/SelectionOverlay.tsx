import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getNamesEntry } from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
import { FLAG_HAS_EXOPLANETS, hasFlag, spectralClassLetter } from '../lib/format';
import { sheetContent } from '../lib/sheet';
import { useLayoutMode } from '../lib/viewport';
import { setSelectionAnchor } from '../scene/selectionAnchor';
import { useGalaxyMapStore } from '../state/store';
import { AnchoredCard } from './hud/AnchoredCard';
import { Badge } from './hud/Badge';
import { ObjectCard } from './hud/ObjectCard';
import { MobileSheet } from './MobileSheet';
import { ArchiveSection, CatalogSection, StarExtraRows, ViewSystemButton } from './StarDetails';
import { StarStatTiles } from './StarStatTiles';
import { useStarHost } from './useStarHost';
import { useStarTitle } from './useStarTitle';

/** The single star card (#23): Base/Advanced, anchored to the selected star. */
function StarCard({ index, mobile }: { index: number; mobile: boolean }) {
  const { t } = useTranslation();
  const { host } = useStarHost(index);
  const { title } = useStarTitle(index);
  const entry = getNamesEntry(index);
  const core = getStarCore();
  const hasExo = hasFlag(core?.flags[index] ?? 0, FLAG_HAS_EXOPLANETS);
  const spectral = spectralClassLetter(core?.spectralClass[index] ?? 7);

  const card = (
    <ObjectCard
      variant={mobile ? 'sheet' : 'floating'}
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
  );
  if (mobile) return <MobileSheet label={title}>{card}</MobileSheet>;
  return <AnchoredCard anchorRef={setSelectionAnchor} anchored card={card} />;
}

export function SelectionOverlay() {
  const index = useGalaxyMapStore((s) =>
    s.view === 'galaxy' && s.selection ? s.selection.index : null,
  );
  const epoch = useGalaxyMapStore((s) => s.selectionEpoch);
  const mobile = useLayoutMode() !== 'desktop';
  const dockPanel = useGalaxyMapStore((s) => s.dockPanel);
  const musicExpanded = useGalaxyMapStore((s) => s.musicExpanded);
  // Only the phone has one panel at a time: on desktop the card stays under an open dock
  // panel or player.
  const content = sheetContent({
    view: 'galaxy',
    hasStar: index !== null,
    hasPlanet: false,
    dockPanel: mobile ? dockPanel : null,
    musicExpanded: mobile && musicExpanded,
  });

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
  return index === null || content !== 'star' ? null : (
    <StarCard key={`${index}:${epoch}`} index={index} mobile={mobile} />
  );
}
