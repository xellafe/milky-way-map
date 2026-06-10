import { describe, expect, it } from 'vitest';
import { useGalaxyMapStore } from '../../src/state/store';

/**
 * Regression guard for the dev-mode OOM (post-M4 bug): React 19's dev-build
 * Performance Tracks serialize component prop/state diffs ELEMENT BY ELEMENT.
 * Multi-million-element typed arrays must therefore never enter the reactive
 * store (nor React state/props): they live in module holders
 * (starCoreStore / starDetailsStore). This test walks the store state and
 * fails if any TypedArray (or huge plain array) sneaks back in.
 */
function findBigPayloads(value: unknown, path: string, found: string[], seen: Set<object>): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    found.push(path);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) found.push(`${path} (array of ${value.length})`);
    value.forEach((v, i) => findBigPayloads(v, `${path}[${i}]`, found, seen));
    return;
  }
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === 'function') continue;
    findBigPayloads(v, `${path}.${key}`, found, seen);
  }
}

describe('store hygiene (dev-mode OOM regression guard)', () => {
  it('the reactive store contains no typed arrays or huge arrays', () => {
    const found: string[] = [];
    findBigPayloads(useGalaxyMapStore.getState(), 'state', found, new Set());
    expect(found).toEqual([]);
  });
});
