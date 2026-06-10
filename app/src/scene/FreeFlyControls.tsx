import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

// Tuning: radians per pixel of mouse drag, and movement speed in ly/s.
const LOOK_SENSITIVITY = 0.0025;
const MOVE_SPEED_LY_PER_S = 25;
const ROLL_SPEED_RAD_PER_S = 1.0;

/**
 * Free-fly camera (SPEC §6.3): drag-to-look follows the MOUSE DELTA 1:1
 * (stop the mouse → rotation stops), unlike three's FlyControls dragToLook,
 * whose rotation rate is proportional to the cursor's offset from the canvas
 * center while holding — which feels broken for normal drags near the center
 * (user-reported). Keyboard: WASD move, R/F up/down, Q/E roll.
 * Yaw/pitch rotate around the camera's LOCAL axes (space-sim style; Q/E give
 * explicit roll). M5 adds orbit-on-lock and animated transitions on top.
 */
export function FreeFlyControls() {
  const { gl, camera } = useThree();
  const keys = useRef(new Set<string>());
  const last = useRef<{ x: number; y: number } | null>(null);

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
      camera.rotateY(-dx * LOOK_SENSITIVITY);
      camera.rotateX(-dy * LOOK_SENSITIVITY);
    };
    const onPointerEnd = (e: PointerEvent) => {
      last.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't steal keys from the search box / panels.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onBlur = () => keys.current.clear();

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerEnd);
      el.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gl, camera]);

  useFrame((_, delta) => {
    const k = keys.current;
    if (k.size === 0) return;
    const move = MOVE_SPEED_LY_PER_S * delta;
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
