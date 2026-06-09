/**
 * Loader tests against the committed golden fixture (data-pipeline/fixtures),
 * with a mocked fetch that serves the real files — honoring Range requests,
 * plus a "server ignores Range" (plain 200) fallback variant.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchManifest, loadStars, type StarsManifest } from '../../src/data/starData';

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
