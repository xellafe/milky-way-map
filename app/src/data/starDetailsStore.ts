import type { StarDetailData } from './starData';

// Detail sections (distances, magnitudes, B–V, luminosity — used by the
// details panel and filters from M3 on). Big typed arrays are deliberately
// kept OUTSIDE the reactive store; null until the background load completes.
let starDetails: StarDetailData | null = null;

export function setStarDetails(details: StarDetailData): void {
  starDetails = details;
}

export function getStarDetails(): StarDetailData | null {
  return starDetails;
}
