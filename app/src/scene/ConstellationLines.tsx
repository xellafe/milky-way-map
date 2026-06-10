import { useEffect, useMemo, useState } from 'react';
import { getConstellations, loadConstellations } from '../data/constellations';
import { getStarCore } from '../data/starCoreStore';
import { useGalaxyMapStore } from '../state/store';
import { buildConstellationGeometry } from './constellationGeometry';

// Subtle steel blue, semi-transparent: visible against black, never competing
// with the stars (SPEC §6.2 — no clutter).
const LINE_COLOR = 0x4a6a96;
const LINE_OPACITY = 0.35;

/**
 * Constellation stick figures (SPEC §6.2): hidden by default, toggleable.
 * constellations.json is fetched lazily on the FIRST toggle-on; the line
 * geometry connects the actual catalog stars in 3D (star indices → SoA
 * positions), so figures look classic from Sol and "explode" when flying
 * away — inherent to a 3D map, not a bug.
 */
export function ConstellationLines() {
  const show = useGalaxyMapStore((s) => s.showConstellations);
  const dataReady = useGalaxyMapStore((s) => s.dataStatus === 'ready');
  const [linesReady, setLinesReady] = useState(false);

  useEffect(() => {
    if (!show || linesReady) return;
    let cancelled = false;
    loadConstellations()
      .then(() => {
        if (!cancelled) setLinesReady(true);
      })
      .catch((error: unknown) => console.warn('constellations load failed', error));
    return () => {
      cancelled = true;
    };
  }, [show, linesReady]);

  const geometry = useMemo(() => {
    if (!show || !linesReady || !dataReady) return null;
    const core = getStarCore();
    const data = getConstellations();
    if (!core || !data) return null;
    return buildConstellationGeometry(data.constellations, core.position);
  }, [show, linesReady, dataReady]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color={LINE_COLOR} transparent opacity={LINE_OPACITY} depthWrite={false} />
    </lineSegments>
  );
}
