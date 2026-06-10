import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadNamesIndex } from './data/namesIndex';
import { setStarCore } from './data/starCoreStore';
import { fetchManifest, loadStars } from './data/starData';
import { setStarDetails } from './data/starDetailsStore';
import { computeDataBounds } from './lib/filterMask';
import { isWebGL2Available } from './lib/webgl';
import { GalaxyScene } from './scene/GalaxyScene';
import { useGalaxyMapStore } from './state/store';
import { FiltersPanel } from './ui/FiltersPanel';
import { HoverLabel } from './ui/HoverLabel';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { SearchBox } from './ui/SearchBox';
import { StarLabelsLayer } from './ui/StarLabelsLayer';
import { StarPanel } from './ui/StarPanel';
import { ViewTogglesPanel } from './ui/ViewTogglesPanel';

const webgl2Available = isWebGL2Available();
const DATA_BASE_URL = '/data/';

export default function App() {
  const { t } = useTranslation();
  const setDataStatus = useGalaxyMapStore((s) => s.setDataStatus);
  const setDataProgress = useGalaxyMapStore((s) => s.setDataProgress);

  useEffect(() => {
    if (!webgl2Available) return;
    let cancelled = false;
    setDataStatus('loading');
    (async () => {
      const manifest = await fetchManifest(DATA_BASE_URL);
      const handle = loadStars(DATA_BASE_URL, manifest, (fraction) => {
        if (!cancelled) setDataProgress(fraction);
      });
      const core = await handle.core;
      if (cancelled) return;
      // The SoA arrays live OUTSIDE React (see starCoreStore docs): React only
      // sees the status flip. Passing them through state/props melts the dev
      // build (React 19 perf-track prop diffing walks every array element).
      setStarCore(core);
      setDataStatus('ready');
      handle.details.then((details) => {
        if (cancelled) return;
        setStarDetails(details);
        // Filter slider bounds come from the real data min/max (SPEC §13).
        useGalaxyMapStore.getState().setDataBounds(computeDataBounds(details));
      });
      // Classic names index (~16 MB): background load for hover labels/search.
      loadNamesIndex(DATA_BASE_URL).catch((error: unknown) =>
        console.warn('names index load failed', error),
      );
    })().catch((error: unknown) => {
      console.error('star data load failed', error);
      if (!cancelled) setDataStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [setDataStatus, setDataProgress]);

  if (!webgl2Available) {
    return (
      <main role="alert" className="flex h-full items-center justify-center bg-black p-8">
        <p className="max-w-prose text-center text-lg text-white">{t('errors.webgl2Required')}</p>
      </main>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <GalaxyScene />
      <StarLabelsLayer />
      <SearchBox />
      <FiltersPanel />
      <ViewTogglesPanel />
      <StarPanel />
      <HoverLabel />
      <LoadingOverlay />
    </div>
  );
}
