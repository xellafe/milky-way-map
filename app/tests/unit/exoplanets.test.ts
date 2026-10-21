import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _setExoplanetsForTests,
  getExoplanetsStatus,
  loadExoplanets,
  normalizeExoplanets,
  searchHosts,
} from '../../src/data/exoplanets';
import { expectRetryAfterFailure } from './loaderRetry';

const starRef = { matchedIndex: 584, matchedBy: 'gaia', matched: true };
const basePlanet = { pl_name: 'X b', pl_orbper: 5.1 };

const HOST_KEYS = [
  'st_met',
  'st_metlim',
  'st_metratio',
  'st_age',
  'st_agelim',
  'st_mass',
  'st_masslim',
  'st_logg',
  'st_logglim',
  'st_spectype',
  'st_rotp',
  'st_rotplim',
  'st_vsin',
  'st_vsinlim',
] as const;
const PLANET_KEYS = [
  'pl_dens',
  'pl_denslim',
  'pl_insol',
  'pl_insollim',
  'pl_bmassprov',
  'pl_bmasselim',
  'pl_radelim',
  'pl_projobliq',
  'pl_projobliqlim',
  'pl_trueobliq',
  'pl_trueobliqlim',
] as const;

describe('normalizeExoplanets', () => {
  it('sets absent advanced fields to null', () => {
    const out = normalizeExoplanets({
      version: 1,
      hosts: { X: { starRef, st_teff: 2900, st_lum: -2.8, st_rad: 0.14, planets: [basePlanet] } },
    });
    const host = out.hosts['X']!;
    for (const k of HOST_KEYS) expect(host[k], k).toBeNull();
    for (const k of PLANET_KEYS) expect(host.planets[0]![k], k).toBeNull();
    expect(host.st_teff).toBe(2900);
    expect(host.planets[0]!.pl_orbper).toBe(5.1);
  });

  it('copies present advanced fields', () => {
    const out = normalizeExoplanets({
      version: 1,
      hosts: {
        X: {
          starRef,
          st_teff: 2900,
          st_lum: -2.8,
          st_rad: 0.14,
          st_mass: 0.12,
          st_masslim: 0,
          st_spectype: 'M5.5 V',
          planets: [{ ...basePlanet, pl_dens: 5.5, pl_denslim: 1, pl_bmassprov: 'Mass' }],
        },
      },
    });
    const host = out.hosts['X']!;
    expect(host.st_mass).toBe(0.12);
    expect(host.st_masslim).toBe(0);
    expect(host.st_spectype).toBe('M5.5 V');
    expect(host.planets[0]!.pl_dens).toBe(5.5);
    expect(host.planets[0]!.pl_denslim).toBe(1);
    expect(host.planets[0]!.pl_bmassprov).toBe('Mass');
    expect(host.planets[0]!.pl_insol).toBeNull();
  });
});

describe('loadExoplanets retry (#36)', () => {
  afterEach(() => {
    _setExoplanetsForTests(null);
    vi.unstubAllGlobals();
  });

  it('retries after a failed fetch, then caches the success', async () => {
    await expectRetryAfterFailure(() => loadExoplanets('/data/'), getExoplanetsStatus, {
      version: 1,
      hosts: {},
    });
  });
});

describe('searchHosts ranking (#37)', () => {
  afterEach(() => _setExoplanetsForTests(null));

  const host = { starRef, st_teff: 2900, st_lum: -2.8, st_rad: 0.14, planets: [basePlanet] };

  it.each(['trappist1', 'TRAPPIST 1'])('%s ranks TRAPPIST-1 before longer names', (q) => {
    _setExoplanetsForTests(
      normalizeExoplanets({
        version: 1,
        hosts: { 'TRAPPIST-1x': host, 'TRAPPIST-10': host, 'TRAPPIST-1': host },
      }),
    );
    expect(searchHosts(q).map((h) => h.hostname)).toEqual([
      'TRAPPIST-1',
      'TRAPPIST-10',
      'TRAPPIST-1x',
    ]);
  });
});
