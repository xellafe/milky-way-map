/**
 * Loader tests against the committed golden fixture (data-pipeline/fixtures),
 * with a mocked fetch that serves the real files — honoring Range requests,
 * plus a "server ignores Range" (plain 200) fallback variant.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchManifest,
  loadStars,
  StarManifestError,
  type StarsManifest,
} from '../../src/data/starData';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

function fixtureFetch(options: { honorRange: boolean }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const name = url.split('/').pop() ?? '';
    const file = readFileSync(path.join(FIXTURES, name));
    const bytes = new Uint8Array(file.byteLength);
    bytes.set(file);

    const headers = new Headers((init?.headers as Record<string, string>) ?? {});
    const range = headers.get('Range');
    if (options.honorRange && range) {
      const m = /bytes=(\d+)-(\d+)/.exec(range);
      if (!m) throw new Error(`bad range: ${range}`);
      const slice = bytes.subarray(Number(m[1]), Number(m[2]) + 1);
      return new Response(slice, { status: 206 });
    }
    return new Response(bytes, { status: 200 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadFixture(honorRange: boolean) {
  vi.stubGlobal('fetch', fixtureFetch({ honorRange }));
  const manifest: StarsManifest = await fetchManifest('/data/');
  const progress: number[] = [];
  const handle = loadStars('/data/', manifest, (f) => progress.push(f));
  const core = await handle.core;
  const details = await handle.details;
  return { manifest, core, details, progress };
}

describe.each([
  ['server honors Range (206)', true],
  ['server ignores Range (200 full-body fallback)', false],
])('loadStars — %s', (_label, honorRange) => {
  it('parses the golden fixture into index-aligned typed arrays', async () => {
    const { manifest, core, details } = await loadFixture(honorRange);
    expect(manifest.count).toBe(1000);
    expect(core.position).toHaveLength(3000);
    expect(core.colorRGB).toHaveLength(3000);
    expect(core.sizeAbsMag).toHaveLength(1000);
    expect(core.spectralClass).toHaveLength(1000);
    expect(core.flags).toHaveLength(1000);
    expect(details.distanceLy).toHaveLength(1000);
    expect(details.luminosity).toHaveLength(1000);
  });

  it('positions are finite and within the catalog range', async () => {
    const { core } = await loadFixture(honorRange);
    for (const v of core.position) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('Sol is at the origin with G spectral class', async () => {
    const { core, details } = await loadFixture(honorRange);
    // Sol is the only star at distance 0 (kept at origin per pipeline contract).
    const sol = details.distanceLy.findIndex((d) => d === 0);
    expect(sol).toBeGreaterThanOrEqual(0);
    expect(core.spectralClass[sol]).toBe(4); // G
    const [x, y, z] = [
      core.position[sol * 3],
      core.position[sol * 3 + 1],
      core.position[sol * 3 + 2],
    ];
    expect(Math.hypot(x!, y!, z!)).toBeLessThan(0.01);
  });

  it('reports monotonic progress ending at 1', async () => {
    const { progress } = await loadFixture(honorRange);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    }
  });

  it('spectral classes stay in the 0..7 contract range', async () => {
    const { core } = await loadFixture(honorRange);
    for (const c of core.spectralClass) {
      expect(c).toBeLessThanOrEqual(7);
    }
  });
});

const STARS_BIN = (() => {
  const file = readFileSync(path.join(FIXTURES, 'stars.bin'));
  const bytes = new Uint8Array(file.byteLength);
  bytes.set(file);
  return bytes;
})();

function goldenManifest(): StarsManifest {
  return JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as StarsManifest;
}

interface BodyStats {
  completed: number;
  cancelled: number;
}

/** A pull-based body that records whether it was read to the end or cancelled. */
function trackedBody(bytes: Uint8Array, stats: BodyStats, chunk = 4096): ReadableStream {
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pos >= bytes.byteLength) {
        controller.close();
        stats.completed++;
        return;
      }
      controller.enqueue(bytes.slice(pos, pos + chunk));
      pos += chunk;
    },
    cancel() {
      stats.cancelled++;
    },
  });
}

/** Serves the golden manifest as JSON and `binResponse` for every stars.bin request. */
function starsFetch(binResponse: (range: [number, number] | null) => Response) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('stars.manifest.json')) {
      return new Response(JSON.stringify(goldenManifest()), { status: 200 });
    }
    const range = new Headers((init?.headers as Record<string, string>) ?? {}).get('Range');
    const m = range ? /bytes=(\d+)-(\d+)/.exec(range) : null;
    return binResponse(m ? [Number(m[1]), Number(m[2])] : null);
  });
}

const binCalls = (fetchMock: { mock: { calls: unknown[][] } }) =>
  fetchMock.mock.calls.filter(([input]) => String(input).endsWith('stars.bin'));

describe('loadStars — server ignores Range: one shared download (#38)', () => {
  it('reads one body to the end, cancels the others unread, requests no detail section', async () => {
    const stats: BodyStats = { completed: 0, cancelled: 0 };
    const fetchMock = starsFetch(
      () => new Response(trackedBody(STARS_BIN, stats), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const manifest = await fetchManifest('/data/');
    const handle = loadStars('/data/', manifest);
    const core = await handle.core;
    const details = await handle.details;

    expect(stats.completed).toBe(1);
    expect(binCalls(fetchMock)).toHaveLength(5); // the five parallel core requests
    expect(stats.cancelled).toBe(4);

    const ranged = await loadFixture(true);
    expect(core).toEqual(ranged.core);
    expect(details).toEqual(ranged.details);
  });

  it('rejects a body shorter than a section with a load error, not a manifest error', async () => {
    vi.stubGlobal(
      'fetch',
      starsFetch(() => new Response(STARS_BIN.slice(0, 20_000), { status: 200 })),
    );
    const manifest = await fetchManifest('/data/');
    const handle = loadStars('/data/', manifest);
    handle.details.catch(() => {});
    const error = await handle.core.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(StarManifestError);
    expect((error as Error).message).toMatch(/got \d+ of \d+ bytes/);
  });
});

describe('loadStars — Range path (#38)', () => {
  it('cancels a 206 body that keeps streaming once the section is complete', async () => {
    let cancelled = 0;
    vi.stubGlobal(
      'fetch',
      starsFetch((range) => {
        const [start, end] = range!;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(STARS_BIN.slice(start, end + 1));
            controller.enqueue(new Uint8Array(64)); // trailing bytes past the range
          },
          pull: () => new Promise<void>(() => {}), // never closes
          cancel() {
            cancelled++;
          },
        });
        return new Response(body, { status: 206 });
      }),
    );
    const manifest = await fetchManifest('/data/');
    const handle = loadStars('/data/', manifest);
    const core = await handle.core;
    await handle.details;
    expect(core.position).toHaveLength(3000);
    expect(cancelled).toBe(10);
  });
});

describe('abort (#38)', () => {
  it('fetchManifest and loadStars pass the signal to every fetch', async () => {
    const fetchMock = fixtureFetch({ honorRange: true });
    vi.stubGlobal('fetch', fetchMock);
    const { signal } = new AbortController();
    const manifest = await fetchManifest('/data/', signal);
    const handle = loadStars('/data/', manifest, () => {}, signal);
    await handle.details;
    expect(fetchMock).toHaveBeenCalledTimes(11);
    for (const [, init] of fetchMock.mock.calls) expect(init?.signal).toBe(signal);
  });

  it('an abort rejects core and details with AbortError and starts no request', async () => {
    const fetchMock = fixtureFetch({ honorRange: true });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const manifest = await fetchManifest('/data/', controller.signal);
    const handle = loadStars('/data/', manifest, () => {}, controller.signal);
    controller.abort();
    const callsAtAbort = fetchMock.mock.calls.length;
    await expect(handle.core).rejects.toMatchObject({ name: 'AbortError' });
    await expect(handle.details).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(callsAtAbort);
  });

  it('an abort during the shared full download rejects with AbortError', async () => {
    vi.stubGlobal('fetch', fixtureFetch({ honorRange: false }));
    const controller = new AbortController();
    const manifest = await fetchManifest('/data/');
    const handle = loadStars('/data/', manifest, () => {}, controller.signal);
    controller.abort();
    await expect(handle.core).rejects.toMatchObject({ name: 'AbortError' });
    await expect(handle.details).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('an already aborted signal makes no stars.bin request', async () => {
    const fetchMock = fixtureFetch({ honorRange: true });
    vi.stubGlobal('fetch', fetchMock);
    const manifest = await fetchManifest('/data/');
    const handle = loadStars('/data/', manifest, () => {}, AbortSignal.abort());
    await expect(handle.core).rejects.toMatchObject({ name: 'AbortError' });
    await expect(handle.details).rejects.toMatchObject({ name: 'AbortError' });
    expect(binCalls(fetchMock)).toHaveLength(0);
  });
});

type RawManifest = Record<string, unknown> & { attributes: Record<string, unknown>[] };
const attr = (m: RawManifest, name: string) => m.attributes.find((a) => a['name'] === name)!;

describe('fetchManifest validation (#38)', () => {
  const cases: [string, (m: RawManifest) => void][] = [
    ['non-integer count', (m) => (m['count'] = 1000.5)],
    ['negative count', (m) => (m['count'] = -1)],
    ['non-integer byteLength', (m) => (m['byteLength'] = '41000')],
    ['negative byteLength', (m) => (m['byteLength'] = -1)],
    [
      'missing attribute',
      (m) => (m.attributes = m.attributes.filter((a) => a['name'] !== 'flags')),
    ],
    ['unknown dtype', (m) => (attr(m, 'appMag')['dtype'] = 'float64')],
    ['non-positive components', (m) => (attr(m, 'flags')['components'] = 0)],
    [
      'byteLength not count × components × sizeof',
      (m) => (attr(m, 'position')['byteLength'] = 11996),
    ],
    ['negative byteOffset', (m) => (attr(m, 'position')['byteOffset'] = -4)],
    ['section past the file end', (m) => (attr(m, 'flags')['byteOffset'] = 40001)],
  ];

  it.each(cases)(
    'throws StarManifestError for %s, before any stars.bin request',
    async (_l, mutate) => {
      const manifest = goldenManifest() as unknown as RawManifest;
      mutate(manifest);
      const fetchMock = vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(fetchManifest('/data/')).rejects.toBeInstanceOf(StarManifestError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('names the attribute and the rule in the message', async () => {
    const manifest = goldenManifest();
    manifest.attributes.find((a) => a.name === 'position')!.byteLength = 11996;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(manifest))),
    );
    await expect(fetchManifest('/data/')).rejects.toThrow(/position.*byteLength/);
  });
});
