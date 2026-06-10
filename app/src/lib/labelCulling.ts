/**
 * Culling for the "always show names" labels (SPEC §6.2): luminosity/zoom
 * based, designed to never clutter the screen. Pure math, unit-tested.
 *
 * Brightness from the CAMERA's position (not from Earth): the standard
 * distance-modulus m = M + 5·log10(d/10pc) with d the star→camera distance.
 * Flying closer to a star makes it (and its label) "brighter" — this is the
 * zoom part of the culling.
 */

export const LY_PER_10_PC = 32.6156; // 10 parsec in light years
/** Labels are considered only when brighter than this from the camera. */
export const LABEL_MAG_LIMIT = 6.5;
/** Hard cap on simultaneous labels. */
export const MAX_LABELS = 20;
/** Minimum on-screen distance between two label anchors (px). */
export const MIN_LABEL_SEPARATION_PX = 64;

export function cameraApparentMagnitude(absMag: number, distanceLy: number): number {
  // Inside ~0.03 ly the log diverges: clamp (labels saturate, never NaN/-inf).
  const d = Math.max(distanceLy, 0.01);
  return absMag + 5 * Math.log10(d / LY_PER_10_PC);
}

export interface LabelCandidate {
  index: number;
  label: string;
  /** Screen-space anchor in CSS px. */
  x: number;
  y: number;
  /** Apparent magnitude from the camera (lower = brighter). */
  mag: number;
}

export interface PlacedLabel {
  index: number;
  label: string;
  x: number;
  y: number;
}

/**
 * Picks the labels to show: brightest first (lowest camera-apparent mag),
 * capped at maxLabels, skipping anything dimmer than LABEL_MAG_LIMIT and any
 * label whose anchor is within minSeparationPx of an already placed one
 * (greedy — the brighter star wins the spot).
 */
export function placeLabels(
  candidates: LabelCandidate[],
  maxLabels = MAX_LABELS,
  minSeparationPx = MIN_LABEL_SEPARATION_PX,
): PlacedLabel[] {
  const sorted = [...candidates]
    .filter((c) => c.mag <= LABEL_MAG_LIMIT)
    .sort((a, b) => a.mag - b.mag);
  const placed: PlacedLabel[] = [];
  const minSq = minSeparationPx * minSeparationPx;
  for (const c of sorted) {
    if (placed.length >= maxLabels) break;
    const tooClose = placed.some((p) => {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      return dx * dx + dy * dy < minSq;
    });
    if (!tooClose) placed.push({ index: c.index, label: c.label, x: c.x, y: c.y });
  }
  return placed;
}
