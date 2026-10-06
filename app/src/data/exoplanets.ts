/**
 * Lazy loader for exoplanets.json (SPEC §5.2). Loaded on demand (~4 MB):
 * first search, or first selection of a star flagged hasExoplanets.
 * Builds a reverse map matchedIndex → hostname for panel lookups.
 */

import { DATA_BASE_URL } from './starData';
import type { Lim } from '../lib/limitedValue';
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
  pl_dens: number | null;
  pl_denslim: Lim;
  pl_insol: number | null;
  pl_insollim: Lim;
  pl_bmassprov: string | null;
  pl_projobliq: number | null;
  pl_projobliqlim: Lim;
  pl_trueobliq: number | null;
  pl_trueobliqlim: Lim;
}

export interface ExoHost {
  starRef: { matchedIndex: number | null; matchedBy: string | null; matched: boolean };
  st_teff: number | null;
  st_lum: number | null;
  st_rad: number | null;
  st_met: number | null;
  st_metlim: Lim;
  st_metratio: string | null;
  st_age: number | null;
  st_agelim: Lim;
  st_mass: number | null;
  st_masslim: Lim;
  st_logg: number | null;
  st_logglim: Lim;
  st_spectype: string | null;
  st_rotp: number | null;
  st_rotplim: Lim;
  st_vsin: number | null;
  st_vsinlim: Lim;
  planets: ExoplanetRecord[];
}

export interface ExoplanetsData {
  version: number;
  hosts: Record<string, ExoHost>;
}

const HOST_NEW_KEYS = [
  'st_met',
  'st_metlim',
  'st_metratio',
  'st_age',
  'st_agelim',
  'st_mass',
  'st_masslim',
  'st_logg',
  'st_logglim',
  'st_spectype',
  'st_rotp',
  'st_rotplim',
  'st_vsin',
  'st_vsinlim',
] as const;
const PLANET_NEW_KEYS = [
  'pl_dens',
  'pl_denslim',
  'pl_insol',
  'pl_insollim',
  'pl_bmassprov',
  'pl_projobliq',
  'pl_projobliqlim',
  'pl_trueobliq',
  'pl_trueobliqlim',
] as const;

/**
 * Fills the advanced fields with null when absent, so a stale cached
 * exoplanets.json (older pipeline output) still loads without undefined leaks.
 */
export function normalizeExoplanets(raw: unknown): ExoplanetsData {
  const d = raw as ExoplanetsData;
  const fill = <T extends object>(o: T, keys: readonly string[]): T => {
    const out = { ...o } as Record<string, unknown>;
    for (const k of keys) out[k] ??= null;
    return out as T;
  };
  const hosts: Record<string, ExoHost> = {};
  for (const [name, h] of Object.entries(d.hosts)) {
    hosts[name] = {
      ...fill(h, HOST_NEW_KEYS),
      planets: h.planets.map((p) => fill(p, PLANET_NEW_KEYS)),
    };
  }
  return { ...d, hosts };
}

let data: ExoplanetsData | null = null;
let hostByIndex: Map<number, string> | null = null;
let loadPromise: Promise<ExoplanetsData> | null = null;

export function loadExoplanets(baseUrl = DATA_BASE_URL): Promise<ExoplanetsData> {
  loadPromise ??= (async () => {
    const resp = await fetch(`${baseUrl}exoplanets.json`);
    if (!resp.ok) throw new Error(`exoplanets fetch failed: ${resp.status}`);
    data = normalizeExoplanets(await resp.json());
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
