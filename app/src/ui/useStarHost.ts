import { useEffect, useState } from 'react';
import { getHost, getHostnameByStarIndex, loadExoplanets, type ExoHost } from '../data/exoplanets';
import { getStarCore } from '../data/starCoreStore';
import { FLAG_HAS_EXOPLANETS, hasFlag } from '../lib/format';

/** Exoplanet host of a catalog star, resolved asynchronously. Results are
 * keyed by star index so a stale answer for a previous selection is ignored
 * at render (no synchronous setState in effects). */
export function useStarHost(index: number): { hostname: string | null; host: ExoHost | null } {
  const [result, setResult] = useState<{
    index: number;
    hostname: string | null;
    host: ExoHost | null;
  } | null>(null);
  const hasExo = hasFlag(getStarCore()?.flags[index] ?? 0, FLAG_HAS_EXOPLANETS);

  useEffect(() => {
    if (!hasExo) return;
    let cancelled = false;
    loadExoplanets()
      .then(() => {
        if (cancelled) return;
        const name = getHostnameByStarIndex(index);
        setResult({ index, hostname: name, host: name ? getHost(name) : null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [index, hasExo]);

  return result?.index === index
    ? { hostname: result.hostname, host: result.host }
    : { hostname: null, host: null };
}
