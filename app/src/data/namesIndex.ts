/**
 * Lazy loader + lookup for names.index.json — the CLASSIC index produced by
 * the pipeline after the CHECKPOINT 1 split: only stars with a proper name or
 * a classic catalog id (HD / HIP / Gliese), plus the constellation.
 * Loaded in the background (~16 MB); Gaia/TYC ids for arbitrary stars come
 * from catalog-ids.bin instead (see catalogIds.ts).
 */

import { DATA_BASE_URL } from './starData';
export interface NamesEntry {
  proper?: string;
  hd?: string;
  hip?: string;
  gl?: string;
  constellation?: string;
}

export type NamesIndex = Record<string, NamesEntry>;

export interface SearchEntry {
  index: number;
  /** Normalized string the query is matched against. */
  key: string;
  /** Human-readable label (proper name or catalog designation). */
  label: string;
}

let namesIndex: NamesIndex | null = null;
let searchEntries: SearchEntry[] | null = null;
let loadPromise: Promise<NamesIndex> | null = null;
let properNamedStars: { index: number; name: string }[] | null = null;

export function normalizeQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ');
}

/** Primary display label for a classic-index entry (SPEC §6.2 priority). */
export function entryLabel(entry: NamesEntry): string {
  if (entry.proper) return entry.proper;
  if (entry.hd) return `HD ${entry.hd}`;
  if (entry.hip) return `HIP ${entry.hip}`;
  if (entry.gl) return entry.gl;
  return '';
}

function buildSearchEntries(index: NamesIndex): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const [key, entry] of Object.entries(index)) {
    const i = Number(key);
    const label = entryLabel(entry);
    if (entry.proper) entries.push({ index: i, key: normalizeQuery(entry.proper), label });
    if (entry.hd) entries.push({ index: i, key: `hd ${entry.hd}`, label });
    if (entry.hip) entries.push({ index: i, key: `hip ${entry.hip}`, label });
    if (entry.gl) {
      const gl = normalizeQuery(entry.gl);
      entries.push({ index: i, key: gl, label });
      // Allow both Gl/GJ prefixes in queries (SPEC §6.4).
      if (gl.startsWith('gl ')) entries.push({ index: i, key: `gj ${gl.slice(3)}`, label });
      if (gl.startsWith('gj ')) entries.push({ index: i, key: `gl ${gl.slice(3)}`, label });
    }
  }
  return entries;
}

export function loadNamesIndex(baseUrl = DATA_BASE_URL): Promise<NamesIndex> {
  loadPromise ??= (async () => {
    const resp = await fetch(`${baseUrl}names.index.json`);
    if (!resp.ok) throw new Error(`names index fetch failed: ${resp.status}`);
    namesIndex = (await resp.json()) as NamesIndex;
    searchEntries = buildSearchEntries(namesIndex);
    return namesIndex;
  })();
  return loadPromise;
}

export function getNamesEntry(index: number): NamesEntry | null {
  return namesIndex?.[String(index)] ?? null;
}

export function isNamesIndexReady(): boolean {
  return namesIndex !== null;
}

/**
 * Stars with a PROPER name (≈450 in HYG) — the candidate set for the
 * always-on labels (SPEC §6.2). Labeling arbitrary catalog ids would be
 * clutter by definition; the curated proper names cover the famous bright
 * stars. Computed once, after the index loads; empty until then.
 */
export function getProperNamedStars(): { index: number; name: string }[] {
  if (properNamedStars) return properNamedStars;
  if (!namesIndex) return [];
  properNamedStars = Object.entries(namesIndex)
    .filter(([, entry]) => entry.proper)
    .map(([key, entry]) => ({ index: Number(key), name: entry.proper! }));
  return properNamedStars;
}

export interface StarSearchResult {
  index: number;
  label: string;
}

/**
 * Search over normalized names/ids (SPEC §6.4 prefix/fuzzy): prefix matches
 * rank first, substring matches after; deduped by star, max `limit`.
 */
export function searchStars(query: string, limit = 8): StarSearchResult[] {
  if (!searchEntries) return [];
  const q = normalizeQuery(query);
  if (q.length < 2) return [];
  const seen = new Set<number>();
  const prefix: StarSearchResult[] = [];
  const substring: StarSearchResult[] = [];
  for (const entry of searchEntries) {
    if (seen.has(entry.index)) continue;
    if (entry.key.startsWith(q)) {
      seen.add(entry.index);
      prefix.push({ index: entry.index, label: entry.label });
      if (prefix.length >= limit) break;
    } else if (substring.length < limit && entry.key.includes(q)) {
      seen.add(entry.index);
      substring.push({ index: entry.index, label: entry.label });
    }
  }
  return [...prefix, ...substring].slice(0, limit);
}

/** Test seam: inject a small synthetic index without fetching. */
export function _setNamesIndexForTests(index: NamesIndex | null): void {
  namesIndex = index;
  searchEntries = index ? buildSearchEntries(index) : null;
  loadPromise = index ? Promise.resolve(index) : null;
  properNamedStars = null;
}
