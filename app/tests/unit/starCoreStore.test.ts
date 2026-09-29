import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { StarCoreData } from '../../src/data/starData';
import { ensureStarGeometry, getStarGeometry } from '../../src/data/starCoreStore';

/**
 * Regression: React StrictMode runs GalaxyScene's useMemo twice in dev. When
 * each call built its own geometry, the holder (rendered by StarCloud) and the
 * geometry receiving the filter mask diverged → filters had no visible effect.
 */
describe('ensureStarGeometry', () => {
  it('builds once per core and always returns the rendered geometry', () => {
    const core = { count: 1 } as StarCoreData;
    const build = vi.fn(() => new THREE.BufferGeometry());
    const first = ensureStarGeometry(core, build);
    const second = ensureStarGeometry(core, build);
    expect(second).toBe(first);
    expect(getStarGeometry()).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('rebuilds for a new core', () => {
    const build = vi.fn(() => new THREE.BufferGeometry());
    const a = ensureStarGeometry({ count: 1 } as StarCoreData, build);
    const b = ensureStarGeometry({ count: 2 } as StarCoreData, build);
    expect(b).not.toBe(a);
    expect(getStarGeometry()).toBe(b);
  });
});
