import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadNamesIndex } from './data/namesIndex';
import { setStarCore } from './data/starCoreStore';
import { DATA_BASE_URL, fetchManifest, loadStars } from './data/starData';
import { setStarDetails } from './data/starDetailsStore';
import { computeDataBounds } from './lib/filterMask';
import { isWebGL2Available } from './lib/webgl';
import { GalaxyScene } from './scene/GalaxyScene';
import { SystemScene } from './scene/SystemScene';
import { useGalaxyMapStore } from './state/store';
import { BottomStack } from './ui/BottomStack';
import { HelpButton } from './ui/HelpButton';
import { HoverLabel } from './ui/HoverLabel';
import { LanguageSelector } from './ui/LanguageSelector';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { MusicPlayer } from './ui/MusicPlayer';
import { SearchBox } from './ui/SearchBox';
import { SelectionOverlay } from './ui/SelectionOverlay';
import { StarLabelsLayer } from './ui/StarLabelsLayer';
import { SystemOverlay } from './ui/SystemOverlay';
import { WelcomeDialog } from './ui/WelcomeDialog';

const webgl2Available = isWebGL2Available();

export default function App() {
  const { t, i18n } = useTranslation();
  const view = useGalaxyMapStore((s) => s.view);
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

  // Keep <html lang> in sync with the active language (a11y / SPEC §6.9):
  // screen readers pick pronunciation from the document language.
  useEffect(() => {
    const sync = (lng: string) => {
      document.documentElement.lang = lng.split('-')[0]!;
    };
    sync(i18n.language);
    i18n.on('languageChanged', sync);
    return () => i18n.off('languageChanged', sync);
  }, [i18n]);

  if (!webgl2Available) {
    return (
      <main role="alert" className="flex h-full items-center justify-center bg-black p-8">
        <p className="max-w-prose text-center text-lg text-white">{t('errors.webgl2Required')}</p>
      </main>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {view === 'galaxy' ? (
        <>
          <GalaxyScene />
          <StarLabelsLayer />
          <SearchBox />
          <SelectionOverlay />
          <HoverLabel />
        </>
      ) : (
        <>
          <SystemScene />
          <SystemOverlay />
        </>
      )}
      <BottomStack />
      {/* Outside the view switch: the <audio> and playback survive view changes. */}
      <MusicPlayer />
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <HelpButton />
        <LanguageSelector />
      </div>
      {/* SPEC §6.3: animated transition into/out of the System View — a CSS
          fade keyed by view (motion-safe only: reduced motion = hard cut). */}
      <div
        key={view}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 bg-black opacity-0 motion-safe:animate-[view-fade_450ms_ease-out]"
      />
      <LoadingOverlay />
      <WelcomeDialog />
    </div>
  );
}
