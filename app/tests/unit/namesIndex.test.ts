import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _setNamesIndexForTests,
  getNamesIndexStatus,
  loadNamesIndex,
  normalizeSearchKey,
  searchStars,
  type NamesIndex,
} from '../../src/data/namesIndex';
import { expectRetryAfterFailure } from './loaderRetry';

afterEach(() => {
  _setNamesIndexForTests(null);
  vi.unstubAllGlobals();
});

describe('loadNamesIndex retry (#36)', () => {
  it('retries after a failed fetch, then caches the success', async () => {
    await expectRetryAfterFailure(() => loadNamesIndex('/data/'), getNamesIndexStatus, {
      '0': { proper: 'Sol' },
    });
  });
});

const labels = (query: string, limit?: number) => searchStars(query, limit).map((r) => r.label);

describe('normalizeSearchKey (#37)', () => {
  it.each([
    ['HD 209458', 'hd209458'],
    ['hd-209458', 'hd209458'],
    ['  HD209458 ', 'hd209458'],
    ['TRAPPIST-1', 'trappist1'],
    ['Gl_551', 'gl551'],
  ])('%s -> %s', (input, expected) => expect(normalizeSearchKey(input)).toBe(expected));
});

describe('searchStars catalog ids without separators (#37)', () => {
  const index: NamesIndex = {
    '0': { proper: 'Sol' },
    '1': { hd: '2094580' },
    '2': { proper: 'Osiris', hd: '209458', hip: '108859' },
    '3': { proper: 'Rigil Kentaurus', hip: '71683', gl: 'Gl 559A' },
    '4': { proper: 'Proxima Centauri', hip: '70890', gl: 'Gl 551' },
    '5': { hd: '1', gl: 'GJ 5510' },
  };

  it.each(['HD209458', 'HD 209458', 'hd-209458'])('%s finds Osiris first', (q) => {
    _setNamesIndexForTests(index);
    expect(searchStars(q)[0]?.index).toBe(2);
  });

  it('finds HIP ids typed without a space', () => {
    _setNamesIndexForTests(index);
    expect(searchStars('HIP71683')[0]?.index).toBe(3);
  });

  it.each(['Gl551', 'GJ 551', 'gj551'])('%s finds the Gliese star via the Gl/GJ alias', (q) => {
    _setNamesIndexForTests(index);
    expect(searchStars(q)[0]?.index).toBe(4);
  });

  it('ignores queries shorter than 2 normalized characters', () => {
    _setNamesIndexForTests(index);
    expect(searchStars(' h- ')).toEqual([]);
  });
});

describe('searchStars ranking (#37)', () => {
  it('ranks the exact key first even past `limit` earlier prefix matches', () => {
    const index: NamesIndex = {};
    for (let n = 10; n <= 19; n++) index[String(n - 10)] = { hip: String(n) };
    index['10'] = { hip: '1' };
    _setNamesIndexForTests(index);
    const results = searchStars('hip 1', 8);
    expect(results).toHaveLength(8);
    expect(results[0]).toEqual({ index: 10, label: 'HIP 1' });
  });

  it('orders prefixes by key length, then key', () => {
    _setNamesIndexForTests({
      '0': { hd: '1000' },
      '1': { hd: '101' },
      '2': { hd: '10' },
      '3': { hd: '1001' },
      '4': { hd: '100' },
    });
    expect(labels('hd 10')).toEqual(['HD 10', 'HD 100', 'HD 101', 'HD 1000', 'HD 1001']);
  });

  it('puts substring matches after all prefix matches', () => {
    _setNamesIndexForTests({
      '0': { hd: '10' },
      '1': { proper: 'Gamma Orionis 10' },
      '2': { proper: '10 Tauri' },
    });
    expect(labels('10')).toEqual(['10 Tauri', 'HD 10', 'Gamma Orionis 10']);
  });

  it('skips the substring scan when exact and prefix matches fill `limit`', () => {
    _setNamesIndexForTests({
      '0': { proper: 'Xcen' },
      '1': { proper: 'Cen A' },
      '2': { proper: 'Cen B' },
    });
    expect(labels('cen', 2)).toEqual(['Cen A', 'Cen B']);
  });

  it('dedupes a star matched by several keys', () => {
    _setNamesIndexForTests({ '0': { proper: 'Gliese', gl: 'Gl 1' } });
    expect(labels('gl')).toEqual(['Gliese']);
  });
});
