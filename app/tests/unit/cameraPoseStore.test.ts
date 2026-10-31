import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { getSavedCameraPose, saveCameraPose } from '../../src/scene/cameraPoseStore';

describe('cameraPoseStore', () => {
  it('is null before the first save', () => {
    expect(getSavedCameraPose()).toBeNull();
  });

  it('reuses one object and its arrays, holding the latest values', () => {
    saveCameraPose(new Vector3(1, 2, 3), new Quaternion(0, 0, 0, 1), {
      lockedStar: 5,
      autoOrbit: true,
    });
    const first = getSavedCameraPose()!;
    const { position, quaternion } = first;
    expect(first.lockedStar).toBe(5);
    expect(first.autoOrbit).toBe(true);

    saveCameraPose(new Vector3(4, 5, 6), new Quaternion(0.5, 0.5, 0.5, 0.5), {
      lockedStar: null,
      autoOrbit: false,
    });
    const second = getSavedCameraPose()!;
    expect(second).toBe(first);
    expect(second.position).toBe(position);
    expect(second.quaternion).toBe(quaternion);
    expect(second.position).toEqual([4, 5, 6]);
    expect(second.quaternion).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(second.lockedStar).toBeNull();
    expect(second.autoOrbit).toBe(false);
  });
});
