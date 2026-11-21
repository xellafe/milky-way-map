import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExoplanetRecord } from '../data/exoplanets';
import { orbitPathPoints } from '../lib/orbit';
import { ORBIT_TINT, planeAngle, TRAIL_BASE_OPACITY, TRAIL_LENGTH_RAD } from '../lib/planetStyle';
import type { PlanetType } from '../lib/planetType';
import orbitTrailFrag from '../shaders/orbit-trail.frag?raw';
import orbitTrailVert from '../shaders/orbit-trail.vert?raw';

// Orbits are real-scale; BODY sizes and looks are not (pscomppars has no
// planet colors): procedural per size class, see lib/planetStyle.ts.
// Orbit line opacity, unitless 0-1 (aesthetic choice, not data).
const ORBIT_OPACITY = 0.7;
// Width of the screen-space "thick" orbit line, CSS px (aesthetic choice, not data).
const THICK_ORBIT_PX = 2.5;
// Line segments per orbit, count: smooth ellipse up to e = 0.99 without a visible
// polygon (aesthetic choice, not data).
const ORBIT_SEGMENTS = 128;
// Dash and gap length of schematic orbits as a fraction of the system scale maxA,
// unitless (aesthetic choice, not data).
const DASH_FRACTION = 0.03;
const DASH_GAP_FRACTION = 0.018;

export interface RenderablePlanet {
  record: ExoplanetRecord;
  semiMajorAxisAU: number;
  eccentricity: number;
  inclinationDeg: number | null;
  schematic: boolean;
  radiusAU: number;
  type: PlanetType;
  seed: number;
}

function orbitShape(planet: RenderablePlanet) {
  return {
    semiMajorAxisAU: planet.semiMajorAxisAU,
    eccentricity: planet.eccentricity,
    inclinationDeg: planet.inclinationDeg,
  };
}

function dashFor(planet: RenderablePlanet, maxA: number): [number, number] {
  // SPEC §6.7: schematic orbits (no inclination) stay dashed in every style.
  return planet.schematic ? [maxA * DASH_FRACTION, maxA * DASH_GAP_FRACTION] : [0, 0];
}

/** Plain 1 px line (the original look), tinted by planet class. */
export function SimpleOrbit({ planet, maxA }: { planet: RenderablePlanet; maxA: number }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(orbitPathPoints(orbitShape(planet), ORBIT_SEGMENTS), 3),
    );
    const color = ORBIT_TINT[planet.type];
    const [dashSize, gapSize] = dashFor(planet, maxA);
    const material = planet.schematic
      ? new THREE.LineDashedMaterial({
          color,
          dashSize,
          gapSize,
          transparent: true,
          opacity: ORBIT_OPACITY,
        })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: ORBIT_OPACITY });
    const obj = new THREE.Line(geometry, material);
    if (planet.schematic) obj.computeLineDistances();
    return obj;
  }, [planet, maxA]);
  // R3F never disposes <primitive> objects, so release the GPU resources here.
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

/** Screen-space thick line (drei Line2). */
export function ThickOrbit({ planet, maxA }: { planet: RenderablePlanet; maxA: number }) {
  const points = useMemo(() => {
    const flat = orbitPathPoints(orbitShape(planet), ORBIT_SEGMENTS);
    const out: [number, number, number][] = [];
    for (let i = 0; i < flat.length; i += 3) out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
    return out;
  }, [planet]);
  const [dashSize, gapSize] = dashFor(planet, maxA);
  return (
    <Line
      points={points}
      color={ORBIT_TINT[planet.type]}
      lineWidth={THICK_ORBIT_PX}
      transparent
      opacity={ORBIT_OPACITY}
      dashed={planet.schematic}
      dashSize={dashSize}
      gapSize={gapSize}
    />
  );
}

/** Faint full orbit + bright trail fading behind the planet. */
export function TrailOrbit({
  planet,
  maxA,
  angle,
}: {
  planet: RenderablePlanet;
  maxA: number;
  angle: () => number;
}) {
  const line = useMemo(() => {
    const flat = orbitPathPoints(orbitShape(planet), ORBIT_SEGMENTS);
    // Angle per vertex in the orbit plane, monotonic 0 → 2π along the path
    // (the path is sampled by eccentric anomaly from periapsis).
    const e = Math.min(Math.max(planet.eccentricity, 0), 0.99);
    const angles = new Float32Array(ORBIT_SEGMENTS + 1);
    for (let s = 0; s <= ORBIT_SEGMENTS; s++) {
      const E = (s / ORBIT_SEGMENTS) * 2 * Math.PI;
      angles[s] =
        s === ORBIT_SEGMENTS
          ? 2 * Math.PI
          : planeAngle(Math.cos(E) - e, Math.sqrt(1 - e * e) * Math.sin(E));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(flat, 3));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: orbitTrailVert,
      fragmentShader: orbitTrailFrag,
      uniforms: {
        uColor: { value: new THREE.Color(ORBIT_TINT[planet.type]) },
        uPlanetAngle: { value: 0 },
        uTrailLength: { value: TRAIL_LENGTH_RAD },
        uBaseOpacity: { value: TRAIL_BASE_OPACITY },
        uDash: { value: new THREE.Vector2(...dashFor(planet, maxA)) },
      },
      transparent: true,
      depthWrite: false,
    });
    const obj = new THREE.Line(geometry, material);
    obj.computeLineDistances(); // lineDistance attribute, used for dashes
    return obj;
  }, [planet, maxA]);
  // R3F never disposes <primitive> objects, so release the GPU resources here.
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  const ref = useRef<THREE.Line<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame(() => {
    const uniforms = ref.current?.material.uniforms;
    if (uniforms) uniforms.uPlanetAngle!.value = angle();
  });
  return <primitive ref={ref} object={line} />;
}
