import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Stats } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { ensureStarGeometry, getStarCore } from '../data/starCoreStore';
import { getStarDetails } from '../data/starDetailsStore';
import { centerShift } from '../lib/sheet';
import { useLayoutMode } from '../lib/viewport';
import { useGalaxyMapStore } from '../state/store';
import { CameraControls } from './CameraControls';
import { ConstellationLines } from './ConstellationLines';
import { StarCloud } from './StarCloud';
import { SelectionTracker } from './SelectionTracker';
import { StarLabels } from './StarLabels';
import { applyFilterMask, buildStarGeometry } from './starGeometry';
import { StarPicking } from './StarPicking';
import { readUsableArea } from './usableArea';

const urlParams = new URLSearchParams(globalThis.location?.search ?? '');
// ?pdb=1 → preserveDrawingBuffer, used by e2e tests to read real pixels back.
const preserveDrawingBuffer = urlParams.get('pdb') === '1';
// ?stats=1 → FPS meter overlay for performance measurements (SPEC §7 budget).
const showStats = urlParams.get('stats') === '1';

/** Test-mode bridge (?pdb=1): exposes camera pose + mode for e2e assertions. */
function CameraDebugBridge() {
  useFrame(({ camera }) => {
    (globalThis as Record<string, unknown>).__camera = {
      position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(),
      mode: useGalaxyMapStore.getState().cameraMode,
      viewOffset: {
        x: camera.view?.enabled ? camera.view.offsetX : 0,
        y: camera.view?.enabled ? camera.view.offsetY : 0,
      },
    };
  });
  return null;
}

/**
 * Phone only (#25): shifts the projection so the camera axis (where the fly-to puts the
 * selected star) lands in the middle of the area the sheet leaves free. Cleared on
 * unmount, so going back to the desktop layout restores the plain projection.
 */
function SheetViewOffset() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(({ size }) => {
    // Without a sheet the whole viewport is free: no shift.
    if (!document.querySelector('[data-hud=mobile-sheet]')) {
      if (camera.view?.enabled) camera.clearViewOffset();
      return;
    }
    const shift = centerShift(readUsableArea(size.width, size.height), size.width, size.height);
    // The window moves opposite to the picture: +x moves the scene left.
    camera.setViewOffset(size.width, size.height, -shift.x, -shift.y, size.width, size.height);
  });
  useEffect(() => () => camera.clearViewOffset(), [camera]);
  return null;
}

/**
 * Root 3D scene: solid black background (SPEC §6.1, no skybox), the star cloud
 * as a single Points draw call, bloom post-processing, free-fly camera.
 * far=2e6 ly covers the farthest (noisy-parallax) catalog stars; depth
 * precision is a non-issue since star points use additive blending without
 * depth writes.
 *
 * The star SoA/geometry deliberately do NOT travel through props — components
 * read them from starCoreStore, keyed by the `dataStatus` flip (see the
 * starCoreStore docs for the React dev-mode OOM this avoids).
 */
export function GalaxyScene() {
  const dataReady = useGalaxyMapStore((s) => s.dataStatus === 'ready');
  const filters = useGalaxyMapStore((s) => s.filters);
  // dataBounds flips when the detail sections land → re-apply range filters.
  const dataBounds = useGalaxyMapStore((s) => s.dataBounds);
  const mobile = useLayoutMode() !== 'desktop';

  const geometry = useMemo(() => {
    const core = dataReady ? getStarCore() : null;
    // Registered during render on purpose: StarCloud/StarPicking children read
    // it in this same render pass (module holder, not reactive state).
    return core ? ensureStarGeometry(core, buildStarGeometry) : null;
  }, [dataReady]);

  useEffect(() => {
    const core = getStarCore();
    if (!geometry || !core) return;
    void dataBounds;
    const visible = applyFilterMask(geometry, core, getStarDetails(), filters);
    useGalaxyMapStore.getState().setVisibleCount(visible);
  }, [geometry, filters, dataBounds]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return (
    <Canvas
      // Without this the browser claims touch gestures (scroll/zoom) and cancels our pointers.
      style={{ touchAction: 'none' }}
      camera={{ position: [0, 0, 40], fov: 60, near: 0.1, far: 2_000_000 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer }}
    >
      <color attach="background" args={[0x000000]} />
      {geometry && <StarCloud />}
      {geometry && <StarPicking />}
      {geometry && <ConstellationLines />}
      {geometry && <StarLabels />}
      <CameraControls />
      {/* After CameraControls: its useFrame runs first, so the projection uses
          this frame's camera pose. */}
      {geometry && <SelectionTracker />}
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.05} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
      {showStats && <Stats />}
      {mobile && <SheetViewOffset />}
      {preserveDrawingBuffer && <CameraDebugBridge />}
    </Canvas>
  );
}
