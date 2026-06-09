import { useMemo } from 'react';
import * as THREE from 'three';
import starFrag from '../shaders/star.frag?raw';
import starVert from '../shaders/star.vert?raw';

// Tuning constants (aesthetic, documented): uPixelScale is multiplied by the
// device pixel ratio at material creation; sizes clamp to [1, 14] px so nearby
// bright stars saturate into the bloom instead of becoming huge discs.
export const STAR_PIXEL_SCALE = 60.0;
export const STAR_MIN_PX = 1.0;
export const STAR_MAX_PX = 14.0;

/**
 * The whole star catalog as ONE THREE.Points / one draw call (SPEC §4.2).
 * Never per-star meshes. Frustum culling is disabled: the cloud surrounds the
 * camera, and computing a bounding sphere over 2.5M points is wasted work.
 */
export function StarCloud({ geometry }: { geometry: THREE.BufferGeometry }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: {
          uPixelScale: {
            value: STAR_PIXEL_SCALE * Math.min(globalThis.devicePixelRatio ?? 1, 2),
          },
          uMinPx: { value: STAR_MIN_PX },
          uMaxPx: { value: STAR_MAX_PX },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
