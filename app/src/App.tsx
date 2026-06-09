import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchManifest, loadStars, type StarCoreData } from './data/starData';
import { setStarDetails } from './data/starDetailsStore';
import { isWebGL2Available } from './lib/webgl';
import { GalaxyScene } from './scene/GalaxyScene';
import { useGalaxyMapStore } from './state/store';
import { LoadingOverlay } from './ui/LoadingOverlay';

const webgl2Available = isWebGL2Available();
const DATA_BASE_URL = '/data/';

export default function App() {
  const { t } = useTranslation();
  const [stars, setStars] = useState<StarCoreData | null>(null);
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
      setStars(core);
      setDataStatus('ready');
      handle.details.then((details) => {
        if (!cancelled) setStarDetails(details);
      });
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
      <GalaxyScene stars={stars} />
      <LoadingOverlay />
    </div>
  );
}
