import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hostSeed, hostStarLook } from '../lib/hostStarStyle';
import { prefersReducedMotion } from '../lib/motion';
import { STAR_COLOR_GAMMA, teffToColor } from '../lib/starColor';
import coronaFrag from '../shaders/host-corona.frag?raw';
import coronaVert from '../shaders/host-corona.vert?raw';
import starFrag from '../shaders/host-star.frag?raw';
import starVert from '../shaders/host-star.vert?raw';
import noiseGlsl from '../shaders/noise.glsl?raw';
import { useSettingsStore } from '../state/settings';

// Corona quad side as a multiple of the star diameter, unitless (aesthetic
// choice, not data). Keep in sync with host-corona.frag.
const CORONA_SCALE = 2.5;

const exposeBridge = new URLSearchParams(globalThis.location?.search ?? '').get('pdb') === '1';

/**
 * Animated host star (issue #16): procedural surface sphere + camera-facing
 * corona. Animation runs on real frame time, deliberately independent of the
 * System View time scale; there is no rotation (period not in the data).
 */
export function HostStar({
  radius,
  teffK,
  hostname,
}: {
  radius: number;
  teffK: number | null;
  hostname: string;
}) {
  const { star, corona } = useMemo(() => {
    // Raw sRGB numbers, no color-space conversion: the shaders write them
    // straight to the framebuffer, like the galaxy star colors.
    const color = new THREE.Color().setHex(teffToColor(teffK), THREE.LinearSRGBColorSpace);
    return {
      star: new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: noiseGlsl + starFrag,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: color },
          uColorGamma: { value: STAR_COLOR_GAMMA },
          uSpots: { value: 1 },
          uSeed: { value: hostSeed(hostname) },
        },
      }),
      corona: new THREE.ShaderMaterial({
        vertexShader: coronaVert,
        fragmentShader: coronaFrag,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: color },
          uIntensity: { value: 1 },
          uPulse: { value: 0 },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }),
    };
  }, [teffK, hostname]);
  useEffect(
    () => () => {
      star.dispose();
      corona.dispose();
    },
    [star, corona],
  );

  // The bridge outlives the scene otherwise, and a re-entered System View would
  // read the previous run's stale clock.
  useEffect(
    () => () => {
      delete (globalThis as Record<string, unknown>).__hostStar;
    },
    [],
  );

  const quad = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  /* eslint-disable react-hooks/immutability -- per-frame uniform updates on materials owned by this component */
  useFrame(({ camera }, delta) => {
    const look = hostStarLook(useSettingsStore.getState().realism, prefersReducedMotion());
    if (look.animate) time.current += delta;
    star.uniforms.uTime!.value = time.current;
    star.uniforms.uColorGamma!.value = look.colorGamma;
    star.uniforms.uSpots!.value = look.spots;
    corona.uniforms.uTime!.value = time.current;
    corona.uniforms.uIntensity!.value = look.coronaIntensity;
    corona.uniforms.uPulse!.value = look.pulseAmplitude;
    quad.current?.quaternion.copy(camera.quaternion);
    if (exposeBridge) {
      (globalThis as Record<string, unknown>).__hostStar = { time: time.current, look };
    }
  });

  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <mesh material={star}>
        <sphereGeometry args={[radius, 64, 32]} />
      </mesh>
      <mesh ref={quad} material={corona} raycast={() => null}>
        <planeGeometry args={[radius * 2 * CORONA_SCALE, radius * 2 * CORONA_SCALE]} />
      </mesh>
    </>
  );
}
