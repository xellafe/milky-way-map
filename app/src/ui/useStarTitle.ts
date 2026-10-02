import { useEffect, useState } from 'react';
import { fetchCatalogIds, type CatalogIds } from '../data/catalogIds';
import { entryLabel, getNamesEntry } from '../data/namesIndex';

/** Display title of a catalog star (classic name, else TYC, else Gaia DR3,
 * else `#index`) plus its catalog ids. Shared by the star panel and the
 * selection overlay so both always show the same title. Ids load async and
 * are keyed by star index (a stale result is ignored at render). */
export function useStarTitle(index: number): { title: string; catalogIds: CatalogIds | null } {
  const [result, setResult] = useState<{ index: number; ids: CatalogIds } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogIds(index)
      .then((ids) => {
        if (!cancelled) setResult({ index, ids });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [index]);

  const catalogIds = result?.index === index ? result.ids : null;
  const entry = getNamesEntry(index);
  const title =
    (entry && entryLabel(entry)) ||
    (catalogIds?.tyc && `TYC ${catalogIds.tyc}`) ||
    (catalogIds?.gaia && `Gaia DR3 ${catalogIds.gaia}`) ||
    `#${index}`;
  return { title, catalogIds };
}
