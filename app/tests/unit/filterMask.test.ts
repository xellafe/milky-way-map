import { describe, expect, it } from 'vitest';
import type { StarCoreData, StarDetailData } from '../../src/data/starData';
import {
  computeDataBounds,
  computeFilterMask,
  DEFAULT_FILTERS,
  isDefaultFilters,
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
    const mask = computeFilterMask(makeCore(), makeDetails(), DEFAULT_FILTERS);
    expect([...mask]).toEqual([1, 1, 1, 1]);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
  });

  it('spectral multi-select hides deselected classes (incl. unknown=7)', () => {
    const spectral = [false, false, false, false, true, false, false, false]; // only G
    const mask = computeFilterMask(makeCore(), makeDetails(), f({ spectralClasses: spectral }));
    expect([...mask]).toEqual([1, 0, 0, 0]);
  });

  it('distance range hides out-of-range and NaN values', () => {
    const mask = computeFilterMask(makeCore(), makeDetails(), f({ distanceLy: [0, 200] }));
    expect([...mask]).toEqual([1, 1, 0, 0]); // 5000 out, NaN hidden under active range
  });

  it('apparent and absolute magnitude ranges combine (AND)', () => {
    const mask = computeFilterMask(
      makeCore(),
      makeDetails(),
      f({ appMag: [0, 10], absMag: [0, 5] }),
    );
    expect([...mask]).toEqual([1, 0, 0, 0]);
  });

  it('only-exoplanets / only-variable / only-multiple use the flag bits', () => {
    const core = makeCore();
    const details = makeDetails();
    expect([...computeFilterMask(core, details, f({ onlyExoplanets: true }))]).toEqual([
      1, 0, 0, 0,
    ]);
    expect([...computeFilterMask(core, details, f({ onlyVariable: true }))]).toEqual([1, 0, 0, 0]);
    expect([...computeFilterMask(core, details, f({ onlyMultiple: true }))]).toEqual([0, 0, 0, 1]);
  });

  it('range filters are skipped while details are still loading', () => {
    const mask = computeFilterMask(makeCore(), null, f({ distanceLy: [0, 1] }));
    expect([...mask]).toEqual([1, 1, 1, 1]);
  });

  it('reuses the provided output buffer', () => {
    const out = new Uint8Array(4);
    const mask = computeFilterMask(makeCore(), makeDetails(), DEFAULT_FILTERS, out);
    expect(mask).toBe(out);
  });
});

describe('computeDataBounds', () => {
  it('derives NaN-safe min/max from the real data (SPEC §13)', () => {
    const bounds = computeDataBounds(makeDetails());
    expect(bounds.distanceLy).toEqual([4.199999809265137, 5000]);
    expect(bounds.appMag).toEqual([1.5, 11]);
    expect(bounds.absMag).toEqual([-1, 12]);
  });
});
