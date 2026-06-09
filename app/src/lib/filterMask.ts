/**
 * Runtime filters (SPEC §6.5): pure computation of the per-star GPU visibility
 * mask. Filters never reload data — the mask is uploaded as a vertex attribute.
 *
 * Semantics:
 * - `null` range = filter inactive (SPEC §13: no pre-filtering at startup).
 * - Active range: stars with NaN in that attribute are hidden (an unknown
 *   value cannot satisfy an explicit user constraint).
 * - spectralClasses[code] = false hides that class (index 7 = unknown).
 */
import type { StarCoreData, StarDetailData } from '../data/starData';
import { FLAG_HAS_EXOPLANETS, FLAG_MULTIPLE, FLAG_VARIABLE } from './format';

export type Range = readonly [number, number];

export interface Filters {
  /** Visibility per spectral class code 0..7 (O..M, 7 = unknown). */
  spectralClasses: readonly boolean[];
  distanceLy: Range | null;
  appMag: Range | null;
  absMag: Range | null;
  onlyExoplanets: boolean;
  onlyMultiple: boolean;
  onlyVariable: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  spectralClasses: [true, true, true, true, true, true, true, true],
  distanceLy: null,
  appMag: null,
  absMag: null,
  onlyExoplanets: false,
  onlyMultiple: false,
  onlyVariable: false,
};

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.spectralClasses.every(Boolean) &&
    f.distanceLy === null &&
    f.appMag === null &&
    f.absMag === null &&
    !f.onlyExoplanets &&
    !f.onlyMultiple &&
    !f.onlyVariable
  );
}

function inRange(value: number, range: Range): boolean {
  // NaN fails both comparisons → hidden under an active range, as documented.
  return value >= range[0] && value <= range[1];
}

/**
 * Compute the visibility mask (1 = visible). `details` may still be loading:
 * range filters are simply skipped until the detail sections are available
 * (the UI keeps them disabled until then).
 */
export function computeFilterMask(
  core: StarCoreData,
  details: StarDetailData | null,
  filters: Filters,
  out?: Uint8Array,
): Uint8Array {
  const n = core.count;
  const mask = out ?? new Uint8Array(n);
  const { spectralClasses, distanceLy, appMag, absMag } = filters;
  const flagsRequired =
    (filters.onlyExoplanets ? FLAG_HAS_EXOPLANETS : 0) |
    (filters.onlyMultiple ? FLAG_MULTIPLE : 0) |
    (filters.onlyVariable ? FLAG_VARIABLE : 0);

  for (let i = 0; i < n; i++) {
    let visible = spectralClasses[core.spectralClass[i]!] === true;
    if (visible && flagsRequired !== 0) {
      visible = (core.flags[i]! & flagsRequired) === flagsRequired;
    }
    if (visible && details) {
      if (distanceLy) visible = inRange(details.distanceLy[i]!, distanceLy);
      if (visible && appMag) visible = inRange(details.appMag[i]!, appMag);
      if (visible && absMag) visible = inRange(details.absMag[i]!, absMag);
    }
    mask[i] = visible ? 1 : 0;
  }
  return mask;
}

export interface DataBounds {
  distanceLy: Range;
  appMag: Range;
  absMag: Range;
}

/** Real data min/max for the slider bounds (SPEC §13), NaN-safe. */
export function computeDataBounds(details: StarDetailData): DataBounds {
  const minMax = (arr: Float32Array): Range => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]!;
      if (Number.isNaN(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return [lo, hi];
  };
  return {
    distanceLy: minMax(details.distanceLy),
    appMag: minMax(details.appMag),
    absMag: minMax(details.absMag),
  };
}
