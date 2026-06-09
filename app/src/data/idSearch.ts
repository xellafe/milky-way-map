/**
 * Exact Gaia / TYC id search via the on-demand buckets produced by the
 * pipeline (CHECKPOINT 1 contract):
 *   search/gaia-XX.json  — XX = (id >> 35) % 256 in hex (healpix bits:
 *                          Gaia DR3 source ids are healpix·2^35 + counter,
 *                          so the LOW bits are structured, not uniform);
 *   search/tyc-XX.json   — XX = TYC1 % 256 in hex, keys "a-b-c".
 * Only the single matching bucket (~100–300 KB) is fetched, then cached.
 */
import type { StarSearchResult } from './namesIndex';

const bucketCache = new Map<string, Promise<Record<string, number>>>();

function fetchBucket(name: string, baseUrl: string): Promise<Record<string, number>> {
  let cached = bucketCache.get(name);
  if (!cached) {
    cached = (async () => {
      const resp = await fetch(`${baseUrl}search/${name}.json`);
      if (resp.status === 404) return {};
      if (!resp.ok) throw new Error(`bucket ${name} fetch failed: ${resp.status}`);
      return (await resp.json()) as Record<string, number>;
    })();
    bucketCache.set(name, cached);
  }
  return cached;
}

const GAIA_QUERY = /^(?:gaia(?:\s*dr\d)?[\s-]*)?(\d{15,20})$/i;
const TYC_QUERY = /^(?:tyc[\s-]*)?(\d{1,5})-(\d{1,6})-(\d{1,2})$/i;

export function looksLikeCatalogId(query: string): boolean {
  const q = query.trim();
  return GAIA_QUERY.test(q) || TYC_QUERY.test(q);
}

export async function searchByCatalogId(
  query: string,
  baseUrl = '/data/',
): Promise<StarSearchResult[]> {
  const q = query.trim();

  const gaia = GAIA_QUERY.exec(q);
  if (gaia) {
    const id = gaia[1]!;
    const bucket = ((BigInt(id) >> 35n) % 256n).toString(16).padStart(2, '0');
    const map = await fetchBucket(`gaia-${bucket}`, baseUrl);
    const index = map[id];
    return index === undefined ? [] : [{ index, label: `Gaia DR3 ${id}` }];
  }

  const tyc = TYC_QUERY.exec(q);
  if (tyc) {
    const key = `${Number(tyc[1])}-${Number(tyc[2])}-${Number(tyc[3])}`;
    const bucket = (Number(tyc[1]) % 256).toString(16).padStart(2, '0');
    const map = await fetchBucket(`tyc-${bucket}`, baseUrl);
    const index = map[key];
    return index === undefined ? [] : [{ index, label: `TYC ${key}` }];
  }

  return [];
}

export function _clearIdSearchCacheForTests(): void {
  bucketCache.clear();
}
