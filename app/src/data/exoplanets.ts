/**
 * Lazy loader for exoplanets.json (SPEC §5.2). Loaded on demand (~2 MB):
 * first search, or first selection of a star flagged hasExoplanets.
 * Builds a reverse map matchedIndex → hostname for panel lookups.
 */

export interface ExoplanetRecord {
  pl_name: string;
  pl_orbper: number | null;
  pl_orbsmax: number | null;
  pl_rade: number | null;
  pl_bmasse: number | null;
  pl_orbeccen: number | null;
  pl_orbincl: number | null;
  discoverymethod: string | null;
  disc_year: number | null;
  pl_eqt: number | null;
  in_hz: boolean | null;
}

export interface ExoHost {
  starRef: { matchedIndex: number | null; matchedBy: string | null; matched: boolean };
  st_teff: number | null;
  st_lum: number | null;
  st_rad: number | null;
  planets: ExoplanetRecord[];
}

export interface ExoplanetsData {
  version: number;
  hosts: Record<string, ExoHost>;
}

let data: ExoplanetsData | null = null;
let hostByIndex: Map<number, string> | null = null;
let loadPromise: Promise<ExoplanetsData> | null = null;

export function loadExoplanets(baseUrl = '/data/'): Promise<ExoplanetsData> {
  loadPromise ??= (async () => {
    const resp = await fetch(`${baseUrl}exoplanets.json`);
    if (!resp.ok) throw new Error(`exoplanets fetch failed: ${resp.status}`);
    data = (await resp.json()) as ExoplanetsData;
    hostByIndex = new Map();
    for (const [name, host] of Object.entries(data.hosts)) {
      if (host.starRef.matched && host.starRef.matchedIndex !== null) {
        hostByIndex.set(host.starRef.matchedIndex, name);
      }
    }
    return data;
  })();
  return loadPromise;
}

export function isExoplanetsReady(): boolean {
  return data !== null;
}

export function getHost(hostname: string): ExoHost | null {
  return data?.hosts[hostname] ?? null;
}

export function getHostnameByStarIndex(index: number): string | null {
  return hostByIndex?.get(index) ?? null;
}

export interface HostSearchResult {
  hostname: string;
  matched: boolean;
  starIndex: number | null;
}

/** Prefix search over host names (e.g. "TRAPPIST-1", "Kepler-22"). */
export function searchHosts(query: string, limit = 5): HostSearchResult[] {
  if (!data) return [];
  const q = query
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
  if (q.length < 2) return [];
  const results: HostSearchResult[] = [];
  for (const [name, host] of Object.entries(data.hosts)) {
    if (
      !name
        .toLowerCase()
        .replace(/[\s\-_]+/g, '')
        .startsWith(q)
    )
      continue;
    results.push({
      hostname: name,
      matched: host.starRef.matched,
      starIndex: host.starRef.matchedIndex,
    });
    if (results.length >= limit) break;
  }
  return results;
}

export function _setExoplanetsForTests(value: ExoplanetsData | null): void {
  data = value;
  hostByIndex = null;
  loadPromise = value ? Promise.resolve(value) : null;
  if (value) {
    hostByIndex = new Map();
    for (const [name, host] of Object.entries(value.hosts)) {
      if (host.starRef.matched && host.starRef.matchedIndex !== null) {
        hostByIndex.set(host.starRef.matchedIndex, name);
      }
    }
  }
}
