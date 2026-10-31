import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Counting subclasses: the per-frame camera helpers must not construct any three object.
const counts = vi.hoisted(() => ({ n: 0 }));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class CountedVector3 extends actual.Vector3 {
    constructor(x?: number, y?: number, z?: number) {
      super(x, y, z);
      counts.n++;
    }
  }
  class CountedQuaternion extends actual.Quaternion {
    constructor(x?: number, y?: number, z?: number, w?: number) {
      super(x, y, z, w);
      counts.n++;
    }
  }
  class CountedMatrix4 extends actual.Matrix4 {
    constructor() {
      super();
      counts.n++;
    }
  }
  return {
    ...actual,
    Vector3: CountedVector3,
    Quaternion: CountedQuaternion,
    Matrix4: CountedMatrix4,
  };
});

import { dollyTowardTarget, orbitAroundTarget } from '../../src/scene/cameraTween';

describe('per-frame camera helpers allocate nothing', () => {
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;
  let target: THREE.Vector3;

  beforeEach(() => {
    position = new THREE.Vector3(10, 4, -3);
    target = new THREE.Vector3(1, 2, 3);
    quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    counts.n = 0;
  });

  it('orbitAroundTarget constructs no three object across 100 calls', () => {
    for (let i = 0; i < 100; i++) orbitAroundTarget(position, quaternion, target, 0.02, 0.01);
    expect(counts.n).toBe(0);
  });

  it('dollyTowardTarget constructs no three object across 100 calls', () => {
    for (let i = 0; i < 100; i++) dollyTowardTarget(position, target, i % 2 ? 1.05 : 0.96);
    expect(counts.n).toBe(0);
  });

  it('orbitAroundTarget keeps the radius and the aim at the target', () => {
    // Aim the camera at the target first so the dot product is meaningful.
    const m = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
    quaternion.setFromRotationMatrix(m);
    const before = position.distanceTo(target);
    orbitAroundTarget(position, quaternion, target, 0.3, 0.2);
    expect(position.distanceTo(target)).toBeCloseTo(before, 6);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const toTarget = target.clone().sub(position).normalize();
    expect(forward.dot(toTarget)).toBeCloseTo(1, 6);
  });

  it('dollyTowardTarget scales the distance', () => {
    const before = position.distanceTo(target);
    dollyTowardTarget(position, target, 0.5);
    expect(position.distanceTo(target)).toBeCloseTo(before * 0.5, 6);
  });
});
