import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getStarCore } from '../data/starCoreStore';
import { prefersReducedMotion } from '../lib/motion';
import { useSettingsStore } from '../state/settings';
import { useGalaxyMapStore } from '../state/store';
import { getSavedCameraPose, saveCameraPose } from './cameraPoseStore';
import {
  type CameraTween,
  createFlyToTween,
  dollyTowardTarget,
  orbitAroundTarget,
  tweenPose,
} from './cameraTween';

// Tuning: radians per pixel of mouse drag. Movement speed and auto-orbit on/off
// are user settings (state/settings.ts).
const LOOK_SENSITIVITY = 0.0025;
const ORBIT_SENSITIVITY = 0.005;
const ROLL_SPEED_RAD_PER_S = 1.0;
// Wheel zoom in orbit: distance factor e^(deltaY·k) — ~×1.1 per 100 px notch.
const ZOOM_PER_WHEEL_DELTA = 0.001;
// Ambient auto-orbit: the camera keeps revolving slowly around a freshly
// locked star until the user orbits manually (drag) or releases the lock.
// ~63 s per full revolution; disabled under prefers-reduced-motion or by the
// user setting.
const AUTO_ORBIT_RAD_PER_S = 0.1;
// Translation keys release the orbit lock (they break the fixed-radius orbit);
// Q/E roll stays available in orbit (it keeps the target centered).
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF'];

/** World position of a star in the cloud (from the module SoA holder). */
function starPosition(index: number): THREE.Vector3 | null {
  const core = getStarCore();
  if (!core) return null;
  const i = index * 3;
  return new THREE.Vector3(core.position[i]!, core.position[i + 1]!, core.position[i + 2]!);
}

/** Selected star position, or null when the selection is a host / nothing. */
function lockedTarget(): THREE.Vector3 | null {
  const s = useGalaxyMapStore.getState();
  return s.cameraMode === 'orbit' && s.selection?.kind === 'star'
    ? starPosition(s.selection.index)
    : null;
}

/**
 * Camera controller (SPEC §6.3): free-fly + orbit-on-lock + animated fly-to.
 *
 * - Free-fly: drag-to-look follows the MOUSE DELTA 1:1 in the grab direction
 *   (drag right → view turns left, #11). Stop the mouse → rotation stops
 *   (regression-tested against three's FlyControls hold-at-offset model).
 *   WASD move, R/F up/down, Q/E roll.
 * - Orbit (entered automatically on star selection, store-side): drag orbits
 *   rigidly around the target, wheel dollies in/out, translation keys release
 *   the lock back to free-fly (selection stays). A fresh lock starts an
 *   ambient AUTO-orbit that revolves around the star until the user takes
 *   over (drag) or releases the lock.
 * - Fly-to (search select AND click select — both land at the fixed
 *   ARRIVE_DISTANCE_LY): position+orientation tween, duration ∝ log of
 *   distance, scaled by the movement-speed setting (#23).
 *   prefers-reduced-motion → instant jump + no auto-orbit. Input is ignored while a tween runs (bounded duration, no cancel edge cases).
 */
export function CameraControls() {
  const { gl, camera } = useThree();
  const keys = useRef(new Set<string>());
  const last = useRef<{ x: number; y: number } | null>(null);
  const tween = useRef<CameraTween | null>(null);
  const lastLockedStar = useRef<number | null>(null);
  // True from lock acquisition until the user orbits manually.
  const autoOrbit = useRef(false);

  // Restore the pose saved before the System View unmounted this Canvas.
  useEffect(() => {
    const saved = getSavedCameraPose();
    if (saved) {
      camera.position.fromArray(saved.position);
      camera.quaternion.fromArray(saved.quaternion);
    }
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!last.current || (e.buttons & 1) === 0) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      if (tween.current) return;
      const target = lockedTarget();
      if (target) {
        autoOrbit.current = false; // manual orbit takes over the ambient one
        orbitAroundTarget(
          camera.position,
          camera.quaternion,
          target,
          dx * ORBIT_SENSITIVITY,
          dy * ORBIT_SENSITIVITY,
        );
      } else {
        // Grab direction (#11): the sky follows the hand, matching the grab cursor.
        camera.rotateY(dx * LOOK_SENSITIVITY);
        camera.rotateX(dy * LOOK_SENSITIVITY);
      }
    };
    const onPointerEnd = (e: PointerEvent) => {
      last.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      if (tween.current) return;
      const target = lockedTarget();
      if (!target) return;
      e.preventDefault();
      dollyTowardTarget(camera.position, target, Math.exp(e.deltaY * ZOOM_PER_WHEEL_DELTA));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't steal keys from the search box / panels, nor from modal dialogs (#12).
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof Element && e.target.closest('dialog')) return;
      keys.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onBlur = () => keys.current.clear();

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gl, camera]);

  useFrame((_, delta) => {
    const store = useGalaxyMapStore.getState();
    saveCameraPose({
      position: camera.position.toArray() as [number, number, number],
      quaternion: camera.quaternion.toArray() as [number, number, number, number],
    });

    // New fly-to request (one-shot from the store) → start a tween.
    if (store.pendingFlyTo) {
      tween.current = createFlyToTween(
        camera.position,
        camera.quaternion,
        new THREE.Vector3(...store.pendingFlyTo),
        prefersReducedMotion(),
        useSettingsStore.getState().moveSpeedLyPerS,
      );
      store.clearFlyTo();
      keys.current.clear(); // held keys must not act the instant we arrive
    }

    // A fresh lock (re)arms the ambient auto-orbit.
    const lockedStar = store.selection?.kind === 'star' ? store.selection.index : null;
    if (lockedStar !== lastLockedStar.current) {
      autoOrbit.current = lockedStar !== null;
      lastLockedStar.current = lockedStar;
    }

    if (tween.current) {
      tween.current.elapsedS += delta;
      if (tweenPose(tween.current, camera.position, camera.quaternion)) tween.current = null;
      return;
    }

    // Ambient auto-orbit: slow revolution around the locked star until the
    // user drags or releases the lock. Perpetual motion → off under
    // prefers-reduced-motion.
    if (autoOrbit.current && lockedStar !== null && store.cameraMode === 'orbit') {
      const target = starPosition(lockedStar);
      if (target && !prefersReducedMotion() && useSettingsStore.getState().autoOrbit) {
        orbitAroundTarget(
          camera.position,
          camera.quaternion,
          target,
          AUTO_ORBIT_RAD_PER_S * delta,
          0,
        );
      }
    }

    const k = keys.current;
    if (k.size === 0) return;
    // Translating breaks the fixed-radius orbit → back to free-fly (SPEC
    // §6.3 lock release; the selection itself stays).
    if (store.cameraMode === 'orbit' && MOVE_KEYS.some((code) => k.has(code))) {
      store.setCameraMode('free-fly');
    }
    const move = useSettingsStore.getState().moveSpeedLyPerS * delta;
    if (k.has('KeyW')) camera.translateZ(-move);
    if (k.has('KeyS')) camera.translateZ(move);
    if (k.has('KeyA')) camera.translateX(-move);
    if (k.has('KeyD')) camera.translateX(move);
    if (k.has('KeyR')) camera.translateY(move);
    if (k.has('KeyF')) camera.translateY(-move);
    const roll = ROLL_SPEED_RAD_PER_S * delta;
    if (k.has('KeyQ')) camera.rotateZ(roll);
    if (k.has('KeyE')) camera.rotateZ(-roll);
  });

  return null;
}
