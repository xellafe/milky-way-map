import type { PlacedLabel } from '../lib/labelCulling';

/**
 * Module holder for the always-on star labels (SPEC §6.2). The placed-label
 * array is rewritten by the in-Canvas updater every refresh tick; React only
 * sees the `labelsVersion` counter bump in the zustand store (per-star data
 * never flows through reactive state — the M4 OOM rule).
 */
let placedLabels: PlacedLabel[] = [];

export function setPlacedLabels(labels: PlacedLabel[]): void {
  placedLabels = labels;
}

export function getPlacedLabels(): PlacedLabel[] {
  return placedLabels;
}
