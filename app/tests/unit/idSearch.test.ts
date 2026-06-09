import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _clearIdSearchCacheForTests,
  looksLikeCatalogId,
  searchByCatalogId,
} from '../../src/data/idSearch';
import { _setNamesIndexForTests, searchStars } from '../../src/data/namesIndex';

afterEach(() => {
  _clearIdSearchCacheForTests();
  _setNamesIndexForTests(null);
  vi.unstubAllGlobals();
});

const GAIA_ID = '5853498713190525696';
const GAIA_BUCKET = ((BigInt(GAIA_ID) >> 35n) % 256n).toString(16).padStart(2, '0');

function stubBuckets(buckets: Record<string, Record<string, number>>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const name = String(input).split('/').pop()!.replace('.json', '');
    const bucket = buckets[name];
    if (!bucket) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(bucket), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('looksLikeCatalogId', () => {
  it.each([
    '5853498713190525696',
    'Gaia DR3 5853498713190525696',
    'TYC 9007-5849-2',
    '9007-5849-2',
  ])('recognizes %s', (q) => expect(looksLikeCatalogId(q)).toBe(true));

  it.each(['polaris', 'HD 8890', '12345'])('rejects %s', (q) =>
    expect(looksLikeCatalogId(q)).toBe(false),
  );
});

describe('searchByCatalogId', () => {
  it('routes gaia ids via (id >> 35) % 256 — not the structured low bits', async () => {
    const fetchMock = stubBuckets({ [`gaia-${GAIA_BUCKET}`]: { [GAIA_ID]: 42 } });
    const results = await searchByCatalogId(`Gaia DR3 ${GAIA_ID}`);
    expect(results).toEqual([{ index: 42, label: `Gaia DR3 ${GAIA_ID}` }]);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(`gaia-${GAIA_BUCKET}.json`);
  });

  it('routes tyc ids via TYC1 % 256 and tolerates the TYC prefix', async () => {
    const bucket = (9007 % 256).toString(16).padStart(2, '0');
    stubBuckets({ [`tyc-${bucket}`]: { '9007-5849-2': 7 } });
    expect(await searchByCatalogId('TYC 9007-5849-2')).toEqual([
      { index: 7, label: 'TYC 9007-5849-2' },
    ]);
    expect(await searchByCatalogId('9007-5849-2')).toEqual([
      { index: 7, label: 'TYC 9007-5849-2' },
    ]);
  });

  it('returns empty on unknown id or missing bucket (404)', async () => {
    stubBuckets({});
    expect(await searchByCatalogId(`Gaia DR3 ${GAIA_ID}`)).toEqual([]);
  });

  it('caches buckets across queries', async () => {
    const bucket = (9007 % 256).toString(16).padStart(2, '0');
    const fetchMock = stubBuckets({ [`tyc-${bucket}`]: { '9007-5849-2': 7, '9007-1-1': 9 } });
    await searchByCatalogId('9007-5849-2');
    await searchByCatalogId('9007-1-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('searchStars substring ranking (SPEC §6.4 prefix/fuzzy)', () => {
  it('prefix matches rank before substring matches', () => {
    _setNamesIndexForTests({
      '1': { proper: 'Proxima Centauri' },
      '2': { proper: 'Centaurus X' },
    });
    const results = searchStars('cen');
    expect(results.map((r) => r.label)).toEqual(['Centaurus X', 'Proxima Centauri']);
  });
});
