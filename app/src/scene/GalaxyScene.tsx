import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { FlyControls, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { getStarCore, setStarGeometry } from '../data/starCoreStore';
import { getStarDetails } from '../data/starDetailsStore';
import { useGalaxyMapStore } from '../state/store';
import { FlyToHandler } from './FlyToHandler';
import { StarCloud } from './StarCloud';
import { applyFilterMask, buildStarGeometry } from './starGeometry';
import { StarPicking } from './StarPicking';

// Free-fly speed in ly/s — the solar neighborhood is a few tens of ly across.
const FLY_SPEED_LY_PER_S = 25;

const urlParams = new URLSearchParams(globalThis.location?.search ?? '');
// ?pdb=1 → preserveDrawingBuffer, used by e2e tests to read real pixels back.
const preserveDrawingBuffer = urlParams.get('pdb') === '1';
// ?stats=1 → FPS meter overlay for performance measurements (SPEC §7 budget).
const showStats = urlParams.get('stats') === '1';

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

  const geometry = useMemo(() => {
    const core = dataReady ? getStarCore() : null;
    const g = core ? buildStarGeometry(core) : null;
    // Registered during render on purpose: StarCloud/StarPicking children read
    // it in this same render pass (module holder, not reactive state).
    setStarGeometry(g);
    return g;
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
      camera={{ position: [0, 0, 40], fov: 60, near: 0.1, far: 2_000_000 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer }}
    >
      <color attach="background" args={[0x000000]} />
      {geometry && <StarCloud />}
      {geometry && <StarPicking />}
      <FlyToHandler />
      <FlyControls movementSpeed={FLY_SPEED_LY_PER_S} rollSpeed={0.4} dragToLook />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.05} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
      {showStats && <Stats />}
    </Canvas>
  );
}
