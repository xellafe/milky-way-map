import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  ARRIVE_DISTANCE_LY,
  createFlyToTween,
  dollyTowardTarget,
  easeInOutCubic,
  FLY_MAX_DURATION_S,
  FLY_MIN_DURATION_S,
  flyToDurationS,
  ORBIT_MIN_DISTANCE_LY,
  orbitAroundTarget,
  tweenPose,
} from '../../src/scene/cameraTween';

/** World-space forward (-z) direction of a camera quaternion. */
const forward = (q: THREE.Quaternion) => new THREE.Vector3(0, 0, -1).applyQuaternion(q);

describe('easeInOutCubic', () => {
  it('fixes endpoints and midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it('is monotonic', () => {
    for (let i = 0; i < 100; i++) {
      expect(easeInOutCubic((i + 1) / 100)).toBeGreaterThan(easeInOutCubic(i / 100));
    }
  });
});

describe('flyToDurationS', () => {
  it('is 0 for zero/invalid distance and clamped otherwise', () => {
    expect(flyToDurationS(0)).toBe(0);
    expect(flyToDurationS(NaN)).toBe(0);
    expect(flyToDurationS(0.001)).toBe(FLY_MIN_DURATION_S);
    expect(flyToDurationS(1e6)).toBe(FLY_MAX_DURATION_S);
  });

  it('grows with distance', () => {
    expect(flyToDurationS(400)).toBeGreaterThan(flyToDurationS(10));
  });
});

describe('createFlyToTween', () => {
  const camPos = new THREE.Vector3(0, 0, 40);
  const camQuat = new THREE.Quaternion(); // looking down -z
  const target = new THREE.Vector3(100, 50, -200);

  it('ends ARRIVE_DISTANCE_LY in front of the target, looking at it', () => {
    const tween = createFlyToTween(camPos, camQuat, target, false);
    expect(tween.toPos.distanceTo(target)).toBeCloseTo(ARRIVE_DISTANCE_LY, 5);
    const lookDir = target.clone().sub(tween.toPos).normalize();
    expect(forward(tween.toQuat).dot(lookDir)).toBeCloseTo(1, 5);
    expect(tween.durationS).toBeGreaterThanOrEqual(FLY_MIN_DURATION_S);
  });

  it('falls back to +z approach when the camera sits on the target', () => {
    const tween = createFlyToTween(target.clone(), camQuat, target, false);
    expect(tween.toPos.distanceTo(target)).toBeCloseTo(ARRIVE_DISTANCE_LY, 5);
  });

  it('reduced motion → duration 0 → tweenPose jumps to the end immediately', () => {
    const tween = createFlyToTween(camPos, camQuat, target, true);
    expect(tween.durationS).toBe(0);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    expect(tweenPose(tween, pos, quat)).toBe(true);
    expect(pos.distanceTo(tween.toPos)).toBeCloseTo(0, 6);
  });
});

describe('tweenPose', () => {
  it('interpolates between the poses and reports completion', () => {
    const tween = createFlyToTween(
      new THREE.Vector3(0, 0, 40),
      new THREE.Quaternion(),
      new THREE.Vector3(0, 0, -100),
      false,
    );
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    tween.elapsedS = tween.durationS / 2;
    expect(tweenPose(tween, pos, quat)).toBe(false);
    // Mid-flight: strictly between start and end (straight-line path).
    expect(pos.distanceTo(tween.fromPos)).toBeGreaterThan(1);
    expect(pos.distanceTo(tween.toPos)).toBeGreaterThan(1);

    tween.elapsedS = tween.durationS + 0.1;
    expect(tweenPose(tween, pos, quat)).toBe(true);
    expect(pos.distanceTo(tween.toPos)).toBeCloseTo(0, 6);
  });
});

describe('orbitAroundTarget', () => {
  it('preserves the distance and keeps the target centered', () => {
    const target = new THREE.Vector3(5, -3, 12);
    const position = target.clone().add(new THREE.Vector3(0, 0, 10));
    const quaternion = new THREE.Quaternion(); // looking down -z → at the target
    orbitAroundTarget(position, quaternion, target, 0.7, -0.3);

    expect(position.distanceTo(target)).toBeCloseTo(10, 6);
    expect(position.distanceTo(target.clone().add(new THREE.Vector3(0, 0, 10)))).toBeGreaterThan(1);
    const lookDir = target.clone().sub(position).normalize();
    expect(forward(quaternion).dot(lookDir)).toBeCloseTo(1, 6);
  });

  it('keeps an off-center target at the same screen offset (rigid rotation)', () => {
    const target = new THREE.Vector3(3, 0, 0);
    const position = new THREE.Vector3(0, 0, 10);
    const quaternion = new THREE.Quaternion(); // NOT looking at the target
    const beforeLocal = target.clone().sub(position).applyQuaternion(quaternion.clone().invert());
    orbitAroundTarget(position, quaternion, target, 0.5, 0.2);
    const afterLocal = target.clone().sub(position).applyQuaternion(quaternion.clone().invert());
    expect(afterLocal.distanceTo(beforeLocal)).toBeCloseTo(0, 6);
  });
});

describe('dollyTowardTarget', () => {
  const target = new THREE.Vector3(1, 2, 3);

  it('scales the distance by the factor', () => {
    const position = target.clone().add(new THREE.Vector3(0, 0, 10));
    dollyTowardTarget(position, target, 0.5);
    expect(position.distanceTo(target)).toBeCloseTo(5, 6);
  });

  it('clamps at the minimum distance', () => {
    const position = target.clone().add(new THREE.Vector3(0, 0, 1));
    dollyTowardTarget(position, target, 1e-9);
    expect(position.distanceTo(target)).toBeCloseTo(ORBIT_MIN_DISTANCE_LY, 6);
  });
});
