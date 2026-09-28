import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getStarGeometry } from '../data/starCoreStore';
import { prefersReducedMotion } from '../lib/motion';
import starFrag from '../shaders/star.frag?raw';
import starVert from '../shaders/star.vert?raw';

// Tuning constants (aesthetic, documented): uPixelScale is multiplied by the
// device pixel ratio at material creation; sizes clamp to [1, 24] px: large enough
// for nearby bright stars to show the fireball core/corona, small enough not
// to become huge discs.
// Screen size = STAR_PIXEL_SCALE · size^STAR_SIZE_GAMMA / dist^STAR_DIST_EXP
// (aesthetic, SPEC §6.1 still holds: bigger for brighter absolute magnitude,
// perspective-attenuated). With the plain size/dist law almost every star
// beyond a few tens of ly collapsed to the 1 px floor and looked identical:
// the gamma widens the 32:1 catalog size range, the softer distance exponent
// keeps far giants visibly larger than dwarfs at the same distance.
export const STAR_PIXEL_SCALE = 25.0;
export const STAR_SIZE_GAMMA = 1.2;
export const STAR_DIST_EXP = 0.75;
export const STAR_MIN_PX = 1.0;
export const STAR_MAX_PX = 24.0;
// Hue exaggeration in the fragment shader (aesthetic, SPEC §13): per-channel
// power curve on the pastel catalog colors; neutral white stays white.
export const STAR_COLOR_GAMMA = 2.5;
// Twinkle (aesthetic): brightness swings ±STAR_TWINKLE_AMPLITUDE on stars
// farther than the range start (ly from camera), full effect past its end.
// Disabled under prefers-reduced-motion (SPEC §6.9).
export const STAR_TWINKLE_AMPLITUDE = 0.5;
export const STAR_TWINKLE_NEAR_LY = 20;
export const STAR_TWINKLE_FAR_LY = 200;
// Time scale of the twinkle waves (1 = shader base frequencies ~0.3–1.4 Hz).
export const STAR_TWINKLE_SPEED = 2 / 3;

/**
 * The whole star catalog as ONE THREE.Points / one draw call (SPEC §4.2).
 * Never per-star meshes. Frustum culling is disabled: the cloud surrounds the
 * camera, and computing a bounding sphere over 2.5M points is wasted work.
 * The geometry is read from starCoreStore, NOT received as a prop (React dev
 * prop diffing would walk the multi-million-element buffers — see store docs).
 */
export function StarCloud() {
  const geometry = getStarGeometry();
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
          uSizeGamma: { value: STAR_SIZE_GAMMA },
          uDistExp: { value: STAR_DIST_EXP },
          uColorGamma: { value: STAR_COLOR_GAMMA },
          uTime: { value: 0 },
          uTwinkle: { value: STAR_TWINKLE_AMPLITUDE },
          uTwinkleRange: { value: new THREE.Vector2(STAR_TWINKLE_NEAR_LY, STAR_TWINKLE_FAR_LY) },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame(({ clock }) => {
    const uniforms = pointsRef.current?.material.uniforms;
    if (!uniforms) return;
    uniforms.uTime!.value = clock.elapsedTime * STAR_TWINKLE_SPEED;
    uniforms.uTwinkle!.value = prefersReducedMotion() ? 0 : STAR_TWINKLE_AMPLITUDE;
  });

  if (!geometry) return null;
  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
