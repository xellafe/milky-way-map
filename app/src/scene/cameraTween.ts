import * as THREE from 'three';
import { DEFAULT_SETTINGS } from '../state/settings';

/** Distance (ly) at which a fly-to stops in front of the target star. */
export const ARRIVE_DISTANCE_LY = 4;
export const FLY_MIN_DURATION_S = 0.8;
export const FLY_MAX_DURATION_S = 2.5;
// Bounds (s) of the speed-scaled fly-to: human choice (#23), not data. Wider than the
// distance-only bounds above so the movement-speed slider (5-200 ly/s) stays noticeable.
export const FLY_SPEED_MIN_DURATION_S = 0.3;
export const FLY_SPEED_MAX_DURATION_S = 8;
/** Closest the orbit dolly may get to the target (ly). */
export const ORBIT_MIN_DISTANCE_LY = 0.1;
export const ORBIT_MAX_DISTANCE_LY = 1_000_000;

/**
 * Camera pose interpolation for SPEC §6.3 transitions (fly-to, aim-on-lock).
 * Pure three.js math, no React/store dependencies — unit-testable.
 * With prefers-reduced-motion the caller passes reducedMotion=true and the
 * tween degenerates to duration 0 (instant jump, same end pose).
 */
export interface CameraTween {
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toPos: THREE.Vector3;
  toQuat: THREE.Quaternion;
  durationS: number;
  elapsedS: number;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Flight time grows with the log of the travel distance (clamped to [min, max]),
 * then scales inversely with the movement speed relative to the default (#23).
 */
export function flyToDurationS(
  distanceLy: number,
  speedLyPerS: number = DEFAULT_SETTINGS.moveSpeedLyPerS,
): number {
  if (!(distanceLy > 0)) return 0;
  const d = 0.5 + 0.25 * Math.log2(1 + distanceLy);
  const base = Math.min(Math.max(d, FLY_MIN_DURATION_S), FLY_MAX_DURATION_S);
  const scaled = (base * DEFAULT_SETTINGS.moveSpeedLyPerS) / speedLyPerS;
  return Math.min(Math.max(scaled, FLY_SPEED_MIN_DURATION_S), FLY_SPEED_MAX_DURATION_S);
}

/**
 * Quaternion looking from `position` toward `target`, keeping the camera's
 * CURRENT up vector (derived from its quaternion) so an intentionally rolled
 * camera (Q/E) does not snap upright when a transition starts.
 */
function lookQuaternion(
  position: THREE.Vector3,
  target: THREE.Vector3,
  currentQuat: THREE.Quaternion,
): THREE.Quaternion {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat);
  const m = new THREE.Matrix4().lookAt(position, target, up);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Fly-to tween: end pose is ARRIVE_DISTANCE_LY in front of the target along
 * the current approach direction, looking at it (the star ends up
 * screen-centered — relied upon by the selection e2e tests).
 */
export function createFlyToTween(
  cameraPos: THREE.Vector3,
  cameraQuat: THREE.Quaternion,
  target: THREE.Vector3,
  reducedMotion: boolean,
  speedLyPerS: number = DEFAULT_SETTINGS.moveSpeedLyPerS,
): CameraTween {
  const approach = cameraPos.clone().sub(target);
  if (approach.lengthSq() < 1e-6) approach.set(0, 0, 1);
  approach.setLength(ARRIVE_DISTANCE_LY);
  const toPos = target.clone().add(approach);
  return {
    fromPos: cameraPos.clone(),
    fromQuat: cameraQuat.clone(),
    toPos,
    toQuat: lookQuaternion(toPos, target, cameraQuat),
    durationS: reducedMotion ? 0 : flyToDurationS(cameraPos.distanceTo(toPos), speedLyPerS),
    elapsedS: 0,
  };
}

/**
 * Writes the eased pose at tween.elapsedS into outPos/outQuat.
 * Returns true when the tween is finished (end pose written exactly).
 */
export function tweenPose(
  tween: CameraTween,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): boolean {
  const done = tween.durationS <= 0 || tween.elapsedS >= tween.durationS;
  const t = done ? 1 : easeInOutCubic(tween.elapsedS / tween.durationS);
  outPos.lerpVectors(tween.fromPos, tween.toPos, t);
  outQuat.slerpQuaternions(tween.fromQuat, tween.toQuat, t);
  return done;
}

/**
 * Rigid rotation of the camera around `target` by yaw/pitch about the
 * camera's own up/right axes: the target keeps its screen position, distance
 * and roll are preserved, and there is no gimbal lock at the poles.
 * Mutates position and quaternion in place.
 */
export function orbitAroundTarget(
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  target: THREE.Vector3,
  yawRad: number,
  pitchRad: number,
): void {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  const q = new THREE.Quaternion()
    .setFromAxisAngle(up, -yawRad)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right, -pitchRad));
  position.sub(target).applyQuaternion(q).add(target);
  quaternion.premultiply(q);
}

/**
 * Scales the camera→target distance by `factor` (wheel zoom in orbit mode),
 * clamped to [ORBIT_MIN_DISTANCE_LY, ORBIT_MAX_DISTANCE_LY]. Mutates position.
 */
export function dollyTowardTarget(
  position: THREE.Vector3,
  target: THREE.Vector3,
  factor: number,
): void {
  const offset = position.clone().sub(target);
  const length = Math.min(
    Math.max(offset.length() * factor, ORBIT_MIN_DISTANCE_LY),
    ORBIT_MAX_DISTANCE_LY,
  );
  if (offset.lengthSq() < 1e-12) offset.set(0, 0, 1);
  position.copy(target).add(offset.setLength(length));
}
