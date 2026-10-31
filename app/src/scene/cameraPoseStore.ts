import type { Quaternion, Vector3 } from 'three';

/**
 * Module holder for the galaxy camera pose and auto-orbit state. The galaxy Canvas is
 * UNMOUNTED while the System View is open (separate scene/scale); CameraControls
 * saves its state on unmount and restores it on remount, so leaving the system
 * brings the user back exactly where they were.
 */
export interface SavedCameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  lockedStar: number | null;
  autoOrbit: boolean;
}

// One module-owned object, created on the first save and mutated afterwards.
let savedPose: SavedCameraPose | null = null;

export function saveCameraPose(
  position: Vector3,
  quaternion: Quaternion,
  lock: { lockedStar: number | null; autoOrbit: boolean },
): void {
  savedPose ??= {
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    lockedStar: null,
    autoOrbit: false,
  };
  position.toArray(savedPose.position);
  quaternion.toArray(savedPose.quaternion);
  savedPose.lockedStar = lock.lockedStar;
  savedPose.autoOrbit = lock.autoOrbit;
}

export function getSavedCameraPose(): SavedCameraPose | null {
  return savedPose;
}
