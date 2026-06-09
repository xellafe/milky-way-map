import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGalaxyMapStore } from '../state/store';

// Distance (ly) at which the camera stops in front of the target star.
const ARRIVE_DISTANCE_LY = 4;

/**
 * Consumes one-shot fly-to requests from the store: places the camera near
 * the target, looking at it (the star ends up screen-centered — also relied
 * upon by the click-select e2e test). M3 jumps instantly; M5 replaces this
 * with animated tweens + prefers-reduced-motion handling (SPEC §6.3, §9).
 */
export function FlyToHandler() {
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    const target = useGalaxyMapStore.getState().pendingFlyTo;
    if (!target) return;
    const targetVec = new THREE.Vector3(...target);
    const approach = camera.position.clone().sub(targetVec);
    if (approach.lengthSq() < 1e-6) approach.set(0, 0, 1);
    approach.setLength(ARRIVE_DISTANCE_LY);
    camera.position.copy(targetVec).add(approach);
    camera.lookAt(targetVec);
    useGalaxyMapStore.getState().clearFlyTo();
  });

  return null;
}
