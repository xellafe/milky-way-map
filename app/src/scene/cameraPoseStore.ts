/**
 * Module holder for the galaxy camera pose. The galaxy Canvas is UNMOUNTED
 * while the System View is open (separate scene/scale); CameraControls saves
 * its pose every frame and restores it on remount, so leaving the system
 * brings the user back exactly where they were.
 */
export interface SavedCameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

let savedPose: SavedCameraPose | null = null;

export function saveCameraPose(pose: SavedCameraPose): void {
  savedPose = pose;
}

export function getSavedCameraPose(): SavedCameraPose | null {
  return savedPose;
}
