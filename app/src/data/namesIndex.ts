/**
 * Lazy loader + lookup for names.index.json — the CLASSIC index produced by
 * the pipeline after the CHECKPOINT 1 split: only stars with a proper name or
 * a classic catalog id (HD / HIP / Gliese), plus the constellation.
 * Loaded in the background (~16 MB); Gaia/TYC ids for arbitrary stars come
 * from catalog-ids.bin instead (see catalogIds.ts).
 */

import type { LoadStatus } from './loadStatus';
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
let searchIndex: SearchIndex | null = null;
let loadPromise: Promise<NamesIndex> | null = null;
let status: LoadStatus = 'idle';
let properNamedStars: { index: number; name: string }[] | null = null;

/**
 * Single normalizer for star and host keys and queries (#37): separators are
 * dropped, so "HD 209458", "hd-209458" and "HD209458" all become "hd209458".
 */
export function normalizeSearchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
}

interface SearchIndex {
  /** All keys in index order: the substring fallback scans them linearly. */
  entries: SearchEntry[];
  exact: Map<string, SearchEntry[]>;
  /**
   * Entries grouped by key length, each group sorted by key: walking the
   * groups from the query length upward yields prefix matches already ranked
   * by (length, key), found by binary search instead of a full scan.
   */
  byLength: SearchEntry[][];
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
    if (entry.proper) entries.push({ index: i, key: normalizeSearchKey(entry.proper), label });
    if (entry.hd) entries.push({ index: i, key: `hd${normalizeSearchKey(entry.hd)}`, label });
    if (entry.hip) entries.push({ index: i, key: `hip${normalizeSearchKey(entry.hip)}`, label });
    if (entry.gl) {
      const gl = normalizeSearchKey(entry.gl);
      entries.push({ index: i, key: gl, label });
      // Allow both Gl/GJ prefixes in queries (SPEC §6.4).
      if (gl.startsWith('gl')) entries.push({ index: i, key: `gj${gl.slice(2)}`, label });
      if (gl.startsWith('gj')) entries.push({ index: i, key: `gl${gl.slice(2)}`, label });
    }
  }
  return entries;
}

function compareEntries(a: SearchEntry, b: SearchEntry): number {
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return a.index - b.index;
}

function buildSearchIndex(index: NamesIndex): SearchIndex {
  const entries = buildSearchEntries(index);
  const exact = new Map<string, SearchEntry[]>();
  const byLength: SearchEntry[][] = [];
  for (const entry of entries) {
    const same = exact.get(entry.key);
    if (same) same.push(entry);
    else exact.set(entry.key, [entry]);
    (byLength[entry.key.length] ??= []).push(entry);
  }
  for (const group of byLength) group?.sort(compareEntries);
  return { entries, exact, byLength };
}

/** First position in a key-sorted group whose key is >= `q`. */
function lowerBound(group: SearchEntry[], q: string): number {
  let lo = 0;
  let hi = group.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (group[mid]!.key < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function loadNamesIndex(baseUrl = DATA_BASE_URL): Promise<NamesIndex> {
  if (loadPromise) return loadPromise;
  status = 'loading';
  const pending = (async () => {
    const resp = await fetch(`${baseUrl}names.index.json`);
    if (!resp.ok) throw new Error(`names index fetch failed: ${resp.status}`);
    namesIndex = (await resp.json()) as NamesIndex;
    searchIndex = buildSearchIndex(namesIndex);
    status = 'ready';
    return namesIndex;
  })();
  loadPromise = pending;
  // Dropped on failure so the next call retries a transient error (#36).
  pending.catch(() => {
    if (loadPromise !== pending) return;
    loadPromise = null;
    status = 'error';
  });
  return pending;
}

export function getNamesIndexStatus(): LoadStatus {
  return status;
}

export function getNamesEntry(index: number): NamesEntry | null {
  return namesIndex?.[String(index)] ?? null;
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
 * Search over normalized names/ids (SPEC §6.4 prefix/fuzzy, #37), deduped by
 * star, max `limit`: the exact key first, then prefixes ranked by key length
 * and key, then substrings only if those do not fill `limit`.
 */
export function searchStars(query: string, limit = 8): StarSearchResult[] {
  if (!searchIndex) return [];
  const q = normalizeSearchKey(query);
  if (q.length < 2) return [];
  const seen = new Set<number>();
  const results: StarSearchResult[] = [];
  const add = (entry: SearchEntry): boolean => {
    if (!seen.has(entry.index)) {
      seen.add(entry.index);
      results.push({ index: entry.index, label: entry.label });
    }
    return results.length >= limit;
  };

  for (const entry of searchIndex.exact.get(q) ?? []) if (add(entry)) return results;

  const { byLength } = searchIndex;
  for (let length = q.length; length < byLength.length; length++) {
    const group = byLength[length];
    if (!group) continue;
    for (let i = lowerBound(group, q); i < group.length; i++) {
      const entry = group[i]!;
      if (!entry.key.startsWith(q)) break;
      if (add(entry)) return results;
    }
  }

  for (const entry of searchIndex.entries) {
    if (entry.key.includes(q) && add(entry)) break;
  }
  return results;
}

/** Test seam: inject a small synthetic index without fetching. */
export function _setNamesIndexForTests(index: NamesIndex | null): void {
  namesIndex = index;
  searchIndex = index ? buildSearchIndex(index) : null;
  loadPromise = index ? Promise.resolve(index) : null;
  status = index ? 'ready' : 'idle';
  properNamedStars = null;
}
