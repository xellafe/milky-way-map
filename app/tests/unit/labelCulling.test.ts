import { describe, expect, it } from 'vitest';

import {
  cameraApparentMagnitude,
  LABEL_MAG_LIMIT,
  type LabelCandidate,
  LY_PER_10_PC,
  MAX_LABELS,
  placeLabels,
} from '../../src/lib/labelCulling';

const candidate = (index: number, mag: number, x = index * 200, y = 100): LabelCandidate => ({
  index,
  label: `star-${index}`,
  x,
  y,
  mag,
});

describe('cameraApparentMagnitude', () => {
  it('equals the absolute magnitude at 10 pc', () => {
    expect(cameraApparentMagnitude(4.83, LY_PER_10_PC)).toBeCloseTo(4.83, 6);
  });

  it('gets brighter (smaller) when the camera approaches — the zoom culling', () => {
    const far = cameraApparentMagnitude(2, 100);
    const near = cameraApparentMagnitude(2, 10);
    expect(near).toBeLessThan(far);
    expect(far - near).toBeCloseTo(5, 6); // ×10 distance = +5 mag
  });

  it('never returns NaN/-Infinity at zero distance (clamped)', () => {
    expect(Number.isFinite(cameraApparentMagnitude(4.83, 0))).toBe(true);
  });
});

describe('placeLabels', () => {
  it('keeps the brightest first and caps at maxLabels', () => {
    const candidates = Array.from({ length: 30 }, (_, i) => candidate(i, i * 0.1));
    const placed = placeLabels(candidates);
    expect(placed.length).toBe(MAX_LABELS);
    expect(placed[0]!.index).toBe(0); // brightest (lowest mag) wins
  });

  it('drops everything dimmer than LABEL_MAG_LIMIT', () => {
    const placed = placeLabels([candidate(1, LABEL_MAG_LIMIT + 0.1), candidate(2, 1)]);
    expect(placed.map((p) => p.index)).toEqual([2]);
  });

  it('greedy separation: the brighter star wins a contested spot', () => {
    const placed = placeLabels(
      [candidate(1, 3, 100, 100), candidate(2, 1, 110, 110), candidate(3, 2, 800, 100)],
      MAX_LABELS,
      64,
    );
    expect(placed.map((p) => p.index)).toEqual([2, 3]); // 1 is within 64 px of 2
  });

  it('returns an empty layout for no candidates', () => {
    expect(placeLabels([])).toEqual([]);
  });
});
