import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getStarGeometry } from '../data/starCoreStore';
import { prefersReducedMotion } from '../lib/motion';
import { STAR_COLOR_GAMMA } from '../lib/starColor';
import { DEFAULT_SETTINGS, useSettingsStore } from '../state/settings';
import starFrag from '../shaders/star.frag?raw';
import starVert from '../shaders/star.vert?raw';

// Tuning constants (aesthetic, documented): uPixelScale is multiplied by the
// device pixel ratio at material creation; sizes clamp to [1, 24] px: large enough
// for nearby bright stars to show the fireball core/corona, small enough not
// to become huge discs.
// Screen size = STAR_PIXEL_SCALE · size^sizeGamma / dist^STAR_DIST_EXP
// (aesthetic, SPEC §6.1 still holds: bigger for brighter absolute magnitude,
// perspective-attenuated). With the plain size/dist law almost every star
// beyond a few tens of ly collapsed to the 1 px floor and looked identical:
// the gamma widens the 32:1 catalog size range, the softer distance exponent
// keeps far giants visibly larger than dwarfs at the same distance.
export const STAR_PIXEL_SCALE = 25.0;
export const STAR_DIST_EXP = 0.75;
export const STAR_MIN_PX = 1.0;
export const STAR_MAX_PX = 24.0;
// Twinkle (aesthetic): brightness swings ±twinkleAmplitude on stars farther
// than the range start (ly from camera), full effect past its end.
// Disabled under prefers-reduced-motion (SPEC §6.9) and in realism mode.
// Size gamma, twinkle amplitude/speed and realism are user settings
// (state/settings.ts), pushed to the uniforms every frame.
export const STAR_TWINKLE_NEAR_LY = 20;
export const STAR_TWINKLE_FAR_LY = 200;

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
          uSizeGamma: { value: DEFAULT_SETTINGS.sizeGamma },
          uDistExp: { value: STAR_DIST_EXP },
          uColorGamma: { value: STAR_COLOR_GAMMA },
          uFireball: { value: 1 },
          uTime: { value: 0 },
          uTwinkle: { value: DEFAULT_SETTINGS.twinkleAmplitude },
          uTwinkleRange: { value: new THREE.Vector2(STAR_TWINKLE_NEAR_LY, STAR_TWINKLE_FAR_LY) },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame((_, delta) => {
    const uniforms = pointsRef.current?.material.uniforms;
    if (!uniforms) return;
    const s = useSettingsStore.getState();
    // Accumulated (not elapsedTime · speed) so a speed change doesn't jump phase.
    uniforms.uTime!.value += delta * s.twinkleSpeed;
    uniforms.uTwinkle!.value = prefersReducedMotion() || s.realism ? 0 : s.twinkleAmplitude;
    uniforms.uSizeGamma!.value = s.sizeGamma;
    uniforms.uColorGamma!.value = s.realism ? 1 : STAR_COLOR_GAMMA;
    uniforms.uFireball!.value = s.realism ? 0 : 1;
  });

  if (!geometry) return null;
  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
