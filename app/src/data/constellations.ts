/**
 * Lazy loader + module holder for constellations.json (SPEC §6.2): the 88
 * IAU constellations of the Stellarium modern sky culture (CC BY-SA 4.0, see
 * NOTICE.md), with stick-figure lines as polylines of STAR INDICES aligned
 * to stars.bin — 3D positions come from the star SoA at render time.
 * Loaded on first toggle-on only (lines are hidden by default, SPEC §6.2).
 */

export interface Constellation {
  id: string;
  name: string;
  /** Polylines of star indices; empty when no line star is in the catalog. */
  lines: number[][];
}

export interface ConstellationsData {
  source: string;
  license: string;
  droppedSegments: number;
  constellations: Constellation[];
}

let constellations: ConstellationsData | null = null;
let loadPromise: Promise<ConstellationsData> | null = null;

export function loadConstellations(baseUrl = '/data/'): Promise<ConstellationsData> {
  loadPromise ??= (async () => {
    const resp = await fetch(`${baseUrl}constellations.json`);
    if (!resp.ok) throw new Error(`constellations fetch failed: ${resp.status}`);
    constellations = (await resp.json()) as ConstellationsData;
    return constellations;
  })();
  return loadPromise;
}

export function getConstellations(): ConstellationsData | null {
  return constellations;
}

/** Test seam: inject data without fetching. */
export function _setConstellationsForTests(data: ConstellationsData | null): void {
  constellations = data;
  loadPromise = data ? Promise.resolve(data) : null;
}
