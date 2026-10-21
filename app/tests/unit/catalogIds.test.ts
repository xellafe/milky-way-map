import { afterEach, describe, expect, it, vi } from 'vitest';
import { _clearCatalogIdsCacheForTests, fetchCatalogIds } from '../../src/data/catalogIds';

afterEach(() => {
  _clearCatalogIdsCacheForTests();
  vi.unstubAllGlobals();
});

// Three stars; gaia = 100 + index so each record is distinguishable.
function makeFile(): Uint8Array<ArrayBuffer> {
  const file = new Uint8Array(48);
  const view = new DataView(file.buffer);
  for (let i = 0; i < 3; i++) view.setBigUint64(i * 16, BigInt(100 + i), true);
  return file;
}

describe('catalogIds without Range support (200)', () => {
  it('shares one full download between concurrent and later lookups', async () => {
    const file = makeFile();
    const fetchMock = vi.fn(async () => new Response(file, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b, c] = await Promise.all([
      fetchCatalogIds(0),
      fetchCatalogIds(1),
      fetchCatalogIds(2),
    ]);
    expect([a.gaia, b.gaia, c.gaia]).toEqual(['100', '101', '102']);
    expect((await fetchCatalogIds(1)).gaia).toBe('101');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches again after a failed full download', async () => {
    const file = makeFile();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockImplementation(async () => new Response(file, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCatalogIds(0)).rejects.toThrow('network down');
    expect((await fetchCatalogIds(2)).gaia).toBe('102');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('catalogIds with Range support (206)', () => {
  it('issues one 16-byte Range request per index and caches it', async () => {
    const file = makeFile();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const m = /bytes=(\d+)-(\d+)/.exec(new Headers(init?.headers).get('Range') ?? '');
      if (!m) throw new Error('expected Range header');
      return new Response(file.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([fetchCatalogIds(0), fetchCatalogIds(2)]);
    expect([a.gaia, b.gaia]).toEqual(['100', '102']);
    await fetchCatalogIds(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const ranges = fetchMock.mock.calls.map((c) => new Headers(c[1]?.headers).get('Range'));
    expect(ranges).toEqual(['bytes=0-15', 'bytes=32-47']);
  });
});
