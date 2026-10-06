import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _clearCatalogIdsCacheForTests,
  fetchCatalogIds,
  parseCatalogIdsRecord,
} from '../../src/data/catalogIds';
import {
  _setExoplanetsForTests,
  getHost,
  getHostnameByStarIndex,
  searchHosts,
  type ExoplanetsData,
} from '../../src/data/exoplanets';
import { _setNamesIndexForTests, entryLabel, searchStars } from '../../src/data/namesIndex';
import { estimateTeffFromBV } from '../../src/lib/teff';
import { formatNumber, spectralClassLetter } from '../../src/lib/format';

afterEach(() => {
  _setNamesIndexForTests(null);
  _setExoplanetsForTests(null);
  _clearCatalogIdsCacheForTests();
  vi.unstubAllGlobals();
});

describe('estimateTeffFromBV (Ballesteros 2012 — labelled estimate)', () => {
  it('reproduces the Sun within 1%', () => {
    expect(estimateTeffFromBV(0.656)).toBeCloseTo(5770, -2);
  });

  it('is monotonically decreasing with B–V', () => {
    expect(estimateTeffFromBV(-0.2)!).toBeGreaterThan(estimateTeffFromBV(0.65)!);
    expect(estimateTeffFromBV(0.65)!).toBeGreaterThan(estimateTeffFromBV(1.5)!);
  });

  it('returns null for missing B–V (never fabricated)', () => {
    expect(estimateTeffFromBV(Number.NaN)).toBeNull();
  });
});

describe('format helpers', () => {
  it('formats per locale', () => {
    expect(formatNumber(12345.5, 'en', { maximumFractionDigits: 1 })).toBe('12,345.5');
    // Italian CLDR groups only from 5 digits (minimumGroupingDigits = 2).
    expect(formatNumber(12345.5, 'it', { maximumFractionDigits: 1 })).toBe('12.345,5');
  });

  it('returns null for missing values', () => {
    expect(formatNumber(Number.NaN, 'en')).toBeNull();
    expect(formatNumber(null, 'en')).toBeNull();
  });

  it('maps spectral codes, unknown → null', () => {
    expect(spectralClassLetter(0)).toBe('O');
    expect(spectralClassLetter(6)).toBe('M');
    expect(spectralClassLetter(7)).toBeNull();
  });
});

describe('namesIndex search', () => {
  const index = {
    '5': { proper: 'Polaris', hd: '8890', hip: '11767', constellation: 'UMi' },
    '9': { hd: '209458' },
    '12': { gl: 'Gl 551', proper: 'Proxima Centauri', constellation: 'Cen' },
  };

  it('matches proper-name prefixes case-insensitively', () => {
    _setNamesIndexForTests(index);
    expect(searchStars('pola')).toEqual([{ index: 5, label: 'Polaris' }]);
  });

  it('matches HD/HIP designations', () => {
    _setNamesIndexForTests(index);
    expect(searchStars('hd 2094')).toEqual([{ index: 9, label: 'HD 209458' }]);
    expect(searchStars('hip 117')).toEqual([{ index: 5, label: 'Polaris' }]);
  });

  it('accepts both Gl and GJ prefixes', () => {
    _setNamesIndexForTests(index);
    expect(searchStars('gj 551')).toEqual([{ index: 12, label: 'Proxima Centauri' }]);
    expect(searchStars('gl 551')).toEqual([{ index: 12, label: 'Proxima Centauri' }]);
  });

  it('label priority: proper, then HD, HIP, Gl', () => {
    expect(entryLabel({ proper: 'X', hd: '1' })).toBe('X');
    expect(entryLabel({ hd: '1', hip: '2' })).toBe('HD 1');
    expect(entryLabel({ hip: '2' })).toBe('HIP 2');
  });
});

describe('catalogIds', () => {
  function record(gaia: bigint, tyc: [number, number, number]): Uint8Array {
    const buf = new Uint8Array(16);
    const view = new DataView(buf.buffer);
    view.setBigUint64(0, gaia, true);
    view.setUint16(8, tyc[0], true);
    view.setUint16(10, tyc[1], true);
    view.setUint8(12, tyc[2]);
    return buf;
  }

  it('parses gaia as decimal string (beyond JS safe integers)', () => {
    const ids = parseCatalogIdsRecord(record(5853498713190525696n, [9007, 5849, 2]));
    expect(ids.gaia).toBe('5853498713190525696');
    expect(ids.tyc).toBe('9007-5849-2');
  });

  it('zero sentinels → null', () => {
    const ids = parseCatalogIdsRecord(record(0n, [0, 0, 0]));
    expect(ids.gaia).toBeNull();
    expect(ids.tyc).toBeNull();
  });

  it('fetches one record via Range request and caches it', async () => {
    const file = new Uint8Array(48); // 3 stars
    file.set(record(42n, [1, 2, 3]), 16); // star index 1
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const range = new Headers(init?.headers).get('Range');
      const m = /bytes=(\d+)-(\d+)/.exec(range ?? '');
      if (!m) throw new Error('expected Range header');
      return new Response(file.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ids = await fetchCatalogIds(1);
    expect(ids.gaia).toBe('42');
    expect(ids.tyc).toBe('1-2-3');
    await fetchCatalogIds(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  });
});

describe('exoplanets', () => {
  const data: ExoplanetsData = {
    version: 1,
    hosts: {
      'TRAPPIST-1': {
        starRef: { matchedIndex: null, matchedBy: null, matched: false },
        st_teff: 2566,
        st_lum: -3.26,
        st_rad: 0.12,
        st_met: null,
        st_metlim: null,
        st_metratio: null,
        st_age: null,
        st_agelim: null,
        st_mass: null,
        st_masslim: null,
        st_logg: null,
        st_logglim: null,
        st_spectype: null,
        st_rotp: null,
        st_rotplim: null,
        st_vsin: null,
        st_vsinlim: null,
        planets: new Array(7).fill({
          pl_name: 'x',
          pl_orbper: 1,
          pl_orbsmax: 0.01,
          pl_rade: 1,
          pl_bmasse: 1,
          pl_orbeccen: 0,
          pl_orbincl: null,
          discoverymethod: 'Transit',
          disc_year: 2016,
          pl_eqt: 400,
          in_hz: false,
          pl_dens: null,
          pl_denslim: null,
          pl_insol: null,
          pl_insollim: null,
          pl_bmassprov: null,
          pl_projobliq: null,
          pl_projobliqlim: null,
          pl_trueobliq: null,
          pl_trueobliqlim: null,
        }),
      },
      'Proxima Cen': {
        starRef: { matchedIndex: 77, matchedBy: 'gaia', matched: true },
        st_teff: 2900,
        st_lum: -2.8,
        st_rad: 0.14,
        st_met: null,
        st_metlim: null,
        st_metratio: null,
        st_age: null,
        st_agelim: null,
        st_mass: null,
        st_masslim: null,
        st_logg: null,
        st_logglim: null,
        st_spectype: null,
        st_rotp: null,
        st_rotplim: null,
        st_vsin: null,
        st_vsinlim: null,
        planets: [],
      },
    },
  };

  it('maps matched star index → hostname', () => {
    _setExoplanetsForTests(data);
    expect(getHostnameByStarIndex(77)).toBe('Proxima Cen');
    expect(getHostnameByStarIndex(1)).toBeNull();
  });

  it('search tolerates spaces and dashes', () => {
    _setExoplanetsForTests(data);
    expect(searchHosts('trappist1')[0]?.hostname).toBe('TRAPPIST-1');
    expect(searchHosts('TRAPPIST-1')[0]?.matched).toBe(false);
    expect(searchHosts('proxima')[0]?.starIndex).toBe(77);
  });

  it('exposes hosts by name', () => {
    _setExoplanetsForTests(data);
    expect(getHost('TRAPPIST-1')?.planets).toHaveLength(7);
    expect(getHost('Nope')).toBeNull();
  });
});
