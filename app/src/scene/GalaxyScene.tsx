import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { FlyControls, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import type { StarCoreData } from '../data/starData';
import { FlyToHandler } from './FlyToHandler';
import { StarCloud } from './StarCloud';
import { buildStarGeometry } from './starGeometry';
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
 */
export function GalaxyScene({ stars }: { stars: StarCoreData | null }) {
  const geometry = useMemo(() => (stars ? buildStarGeometry(stars) : null), [stars]);

  return (
    <Canvas
      camera={{ position: [0, 0, 40], fov: 60, near: 0.1, far: 2_000_000 }}
      gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer }}
    >
      <color attach="background" args={[0x000000]} />
      {geometry && <StarCloud geometry={geometry} />}
      {geometry && <StarPicking geometry={geometry} />}
      <FlyToHandler />
      <FlyControls movementSpeed={FLY_SPEED_LY_PER_S} rollSpeed={0.4} dragToLook />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.05} luminanceSmoothing={0.2} mipmapBlur />
      </EffectComposer>
      {showStats && <Stats />}
    </Canvas>
  );
}
