import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ConstellationsData } from '../../src/data/constellations';
import { buildConstellationGeometry } from '../../src/scene/constellationGeometry';

const FIXTURES = fileURLToPath(new URL('../../../data-pipeline/fixtures', import.meta.url));

describe('buildConstellationGeometry', () => {
  // Stars laid out 1 ly apart on the x axis: position[i] = (i, 0, 0).
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0]);

  it('expands polylines into segment pairs with the stars’ 3D positions', () => {
    const g = buildConstellationGeometry(
      [
        { id: 'A', name: 'A', lines: [[0, 1, 2]] },
        { id: 'B', name: 'B', lines: [[3, 0]] },
      ],
      positions,
    );
    const attr = g.getAttribute('position');
    // (0,1) (1,2) (3,0) → 3 segments → 6 vertices.
    expect(attr.count).toBe(6);
    const a = attr.array as Float32Array;
    expect([...a.slice(0, 6)]).toEqual([0, 0, 0, 1, 0, 0]); // segment 0-1
    expect([...a.slice(6, 12)]).toEqual([1, 0, 0, 2, 0, 0]); // segment 1-2
    expect([...a.slice(12, 18)]).toEqual([3, 0, 0, 0, 0, 0]); // segment 3-0
    g.dispose();
  });

  it('skips empty constellations and empty line sets', () => {
    const g = buildConstellationGeometry([{ id: 'X', name: 'X', lines: [] }], positions);
    expect(g.getAttribute('position').count).toBe(0);
    g.dispose();
  });

  it('throws on out-of-range star indices (artifact/catalog drift guard)', () => {
    expect(() =>
      buildConstellationGeometry([{ id: 'X', name: 'X', lines: [[0, 99]] }], positions),
    ).toThrow(/out of range/);
  });
});

describe('constellations.json fixture artifact', () => {
  const data = JSON.parse(
    readFileSync(path.join(FIXTURES, 'constellations.json'), 'utf-8'),
  ) as ConstellationsData;
  const manifest = JSON.parse(
    readFileSync(path.join(FIXTURES, 'stars.manifest.json'), 'utf-8'),
  ) as { count: number };

  it('has the 88 IAU constellations and the CC BY-SA license tag', () => {
    expect(data.constellations.length).toBe(88);
    expect(data.license).toContain('CC BY-SA 4.0');
  });

  it('only references stars that exist in the fixture catalog', () => {
    for (const con of data.constellations) {
      for (const line of con.lines) {
        expect(line.length).toBeGreaterThanOrEqual(2);
        for (const index of line) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(manifest.count);
        }
      }
    }
  });

  it('includes Ursa Minor anchored at Polaris (index from the names index)', () => {
    const names = JSON.parse(
      readFileSync(path.join(FIXTURES, 'names.index.json'), 'utf-8'),
    ) as Record<string, { proper?: string }>;
    const polaris = Number(Object.entries(names).find(([, e]) => e.proper === 'Polaris')![0]);
    const umi = data.constellations.find((c) => c.id === 'UMi')!;
    expect(umi.lines.flat()).toContain(polaris);
  });
});
