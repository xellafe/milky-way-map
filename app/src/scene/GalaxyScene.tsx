import { Canvas } from '@react-three/fiber';

/**
 * Root 3D scene. M0: empty scene with solid black background (SPEC §6.1 — no skybox).
 * The star cloud (single THREE.Points + custom shader) arrives in M2.
 */
export function GalaxyScene() {
  return (
    <Canvas camera={{ position: [0, 0, 50], fov: 60, near: 0.1, far: 100_000 }}>
      <color attach="background" args={[0x000000]} />
    </Canvas>
  );
}
