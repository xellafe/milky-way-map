import { describe, expect, it } from 'vitest';
import type { StarCoreData, StarDetailData } from '../../src/data/starData';
import {
  computeDataBounds,
  computeFilterMask,
  DEFAULT_FILTERS,
  isDefaultFilters,
  normalizeRange,
  type Filters,
} from '../../src/lib/filterMask';

// 4 synthetic stars: G with exoplanets+variable, M plain, unknown class, F multiple.
function makeCore(): StarCoreData {
  return {
    count: 4,
    position: new Float32Array(12),
    colorRGB: new Uint8Array(12),
    sizeAbsMag: new Float32Array([1, 0.5, 0.8, 2]),
    spectralClass: new Uint8Array([4, 6, 7, 3]),
    flags: new Uint8Array([0b101, 0, 0, 0b010]), // exo+var | none | none | multiple
  };
}

function makeDetails(): StarDetailData {
  return {
    distanceLy: new Float32Array([4.2, 100, 5000, Number.NaN]),
    appMag: new Float32Array([1.5, 9, 11, 3]),
    absMag: new Float32Array([4.8, 12, 1, -1]),
    colorIndex: new Float32Array(4),
    luminosity: new Float32Array(4),
  };
}

const f = (over: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...over });

describe('computeFilterMask', () => {
  it('default filters show everything (SPEC §13)', () => {
    const { mask } = computeFilterMask(makeCore(), makeDetails(), DEFAULT_FILTERS);
    expect([...mask]).toEqual([1, 1, 1, 1]);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('spectral multi-select hides deselected classes (incl. unknown=7)', () => {
    const spectral = [false, false, false, false, true, false, false, false]; // only G
    const { mask } = computeFilterMask(makeCore(), makeDetails(), f({ spectralClasses: spectral }));
    expect([...mask]).toEqual([1, 0, 0, 0]);
  });

  it('distance range hides out-of-range and NaN values', () => {
    const { mask } = computeFilterMask(makeCore(), makeDetails(), f({ distanceLy: [0, 200] }));
    expect([...mask]).toEqual([1, 1, 0, 0]); // 5000 out, NaN hidden under active range
  });

  it('apparent and absolute magnitude ranges combine (AND)', () => {
    const { mask } = computeFilterMask(
      makeCore(),
      makeDetails(),
      f({ appMag: [0, 10], absMag: [0, 5] }),
    );
    expect([...mask]).toEqual([1, 0, 0, 0]);
  });

  it('only-exoplanets / only-variable / only-multiple use the flag bits', () => {
    const core = makeCore();
    const details = makeDetails();
    const run = (over: Partial<Filters>) => [...computeFilterMask(core, details, f(over)).mask];
    expect(run({ onlyExoplanets: true })).toEqual([1, 0, 0, 0]);
    expect(run({ onlyVariable: true })).toEqual([1, 0, 0, 0]);
    expect(run({ onlyMultiple: true })).toEqual([0, 0, 0, 1]);
  });

  it('range filters are skipped while details are still loading', () => {
    const { mask } = computeFilterMask(makeCore(), null, f({ distanceLy: [0, 1] }));
    expect([...mask]).toEqual([1, 1, 1, 1]);
  });

  it('reuses the provided output buffer', () => {
    const out = new Uint8Array(4);
    const { mask } = computeFilterMask(makeCore(), makeDetails(), DEFAULT_FILTERS, out);
    expect(mask).toBe(out);
  });

  it('returns a visible count equal to the mask sum', () => {
    const r = computeFilterMask(makeCore(), makeDetails(), f({ distanceLy: [0, 200] }));
    expect(r.visible).toBe(2);
    expect(r.visible).toBe(r.mask.reduce((a, b) => a + b, 0));
  });

  it('a range normalized back to the full bounds is neutral and shows NaN stars again', () => {
    const details = makeDetails();
    const bounds = computeDataBounds(details).distanceLy!;
    const active = normalizeRange('max', 10, bounds[0], bounds);
    expect(computeFilterMask(makeCore(), details, f({ distanceLy: active })).mask[3]).toBe(0);
    const back = normalizeRange('max', bounds[1], bounds[0], bounds);
    expect(back).toBeNull();
    const filters = f({ distanceLy: back });
    expect(isDefaultFilters(filters)).toBe(true);
    expect(computeFilterMask(makeCore(), details, filters).mask[3]).toBe(1);
  });
});

describe('computeDataBounds', () => {
  it('derives NaN-safe min/max from the real data (SPEC §13)', () => {
    const bounds = computeDataBounds(makeDetails());
    expect(bounds.distanceLy).toEqual([4.199999809265137, 5000]);
    expect(bounds.appMag).toEqual([1.5, 11]);
    expect(bounds.absMag).toEqual([-1, 12]);
  });

  it('skips NaN and infinities; a column with no finite value gives null', () => {
    const details: StarDetailData = {
      ...makeDetails(),
      distanceLy: new Float32Array([Infinity, 3, -Infinity, 7]),
      appMag: new Float32Array([Number.NaN, Number.NaN]),
      absMag: new Float32Array(0),
    };
    const bounds = computeDataBounds(details);
    expect(bounds.distanceLy).toEqual([3, 7]);
    expect(bounds.appMag).toBeNull();
    expect(bounds.absMag).toBeNull();
  });
});

describe('normalizeRange', () => {
  const bounds = [0, 100] as const;

  it('clamps the edited side to the other end without swapping', () => {
    expect(normalizeRange('min', 80, 50, bounds)).toEqual([50, 50]);
    expect(normalizeRange('max', 10, 30, bounds)).toEqual([30, 30]);
  });

  it('clamps to the data bounds', () => {
    expect(normalizeRange('min', -20, 50, bounds)).toEqual([0, 50]);
    expect(normalizeRange('max', 500, 20, bounds)).toEqual([20, 100]);
  });

  it('returns null when both sides reach the raw bounds', () => {
    expect(normalizeRange('min', -20, 100, bounds)).toBeNull();
    expect(normalizeRange('max', 500, 0, bounds)).toBeNull();
    expect(normalizeRange('min', 0, 100, bounds)).toBeNull();
  });

  it('keeps an active range when one side is inside the bounds', () => {
    expect(normalizeRange('min', 10, 100, bounds)).toEqual([10, 100]);
    expect(normalizeRange('max', 60, 0, bounds)).toEqual([0, 60]);
  });
});
