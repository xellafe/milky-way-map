import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { setPlacedLabels } from '../data/labelStore';
import { getProperNamedStars } from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
import { getStarDetails } from '../data/starDetailsStore';
import { cameraApparentMagnitude, type LabelCandidate, placeLabels } from '../lib/labelCulling';
import { useGalaxyMapStore } from '../state/store';

// Re-layout cadence: labels don't need per-frame precision; 150 ms keeps them
// glued to the stars during flight without measurable cost (~450 candidates).
const UPDATE_INTERVAL_S = 0.15;

/**
 * In-Canvas updater for the always-on star labels (SPEC §6.2 "show names"
 * toggle): projects the proper-named candidate stars, culls by camera-
 * apparent brightness + screen separation (lib/labelCulling), and publishes
 * the result through labelStore + a version bump. The DOM layer that renders
 * the labels lives outside the Canvas (ui/StarLabelsLayer).
 */
export function StarLabels() {
  const show = useGalaxyMapStore((s) => s.showNames);
  const { camera, size } = useThree();
  const elapsed = useRef(0);
  const lastCount = useRef(0);
  const v = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!show) {
      if (lastCount.current > 0) {
        lastCount.current = 0;
        setPlacedLabels([]);
        useGalaxyMapStore.getState().bumpLabelsVersion();
      }
      return;
    }
    elapsed.current += delta;
    if (elapsed.current < UPDATE_INTERVAL_S) return;
    elapsed.current = 0;

    const core = getStarCore();
    const details = getStarDetails();
    const candidates = getProperNamedStars();
    if (!core || !details || candidates.length === 0) return;

    const screen: LabelCandidate[] = [];
    for (const { index, name } of candidates) {
      const i = index * 3;
      const x = core.position[i]!;
      const y = core.position[i + 1]!;
      const z = core.position[i + 2]!;
      const p = v.current.set(x, y, z);
      const distance = p.distanceTo(camera.position);
      p.project(camera);
      // Behind the camera or outside the frustum → no label.
      if (p.z >= 1 || p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) continue;
      screen.push({
        index,
        label: name,
        x: ((p.x + 1) / 2) * size.width,
        y: ((1 - p.y) / 2) * size.height,
        mag: cameraApparentMagnitude(details.absMag[index]!, distance),
      });
    }
    const placed = placeLabels(screen);
    lastCount.current = placed.length;
    setPlacedLabels(placed);
    useGalaxyMapStore.getState().bumpLabelsVersion();
  });

  return null;
}
