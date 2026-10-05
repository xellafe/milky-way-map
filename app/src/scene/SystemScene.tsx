import { Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getHost, type ExoHost, type ExoplanetRecord } from '../data/exoplanets';
import { canvasCursor } from '../lib/canvasCursor';
import { hzBoundsAU, hzInclinationDeg, type HzBounds } from '../lib/habitableZone';
import {
  nameSeed,
  ORBIT_TINT,
  PLANET_PALETTE,
  PLANET_TYPE_INDEX,
  planeAngle,
  TRAIL_BASE_OPACITY,
  TRAIL_LENGTH_RAD,
} from '../lib/planetStyle';
import { classifyPlanet, type PlanetType } from '../lib/planetType';
import { orbitAngleDeg, orbitPathPoints, orbitPlanePosition, toSceneCoords } from '../lib/orbit';
import orbitTrailFrag from '../shaders/orbit-trail.frag?raw';
import orbitTrailVert from '../shaders/orbit-trail.vert?raw';
import hzFrag from '../shaders/hz.frag?raw';
import hzVert from '../shaders/hz.vert?raw';
import noiseGlsl from '../shaders/noise.glsl?raw';
import planetFrag from '../shaders/planet.frag?raw';
import planetVert from '../shaders/planet.vert?raw';
import { useSettingsStore } from '../state/settings';
import { useGalaxyMapStore } from '../state/store';
import { HostStar } from './HostStar';

const SUN_RADIUS_AU = 0.00465;
// Orbits are real-scale; BODY sizes and looks are not (pscomppars has no
// planet colors): procedural per size class, see lib/planetStyle.ts.
const ORBIT_OPACITY = 0.7;
const THICK_ORBIT_PX = 2.5;
const ORBIT_SEGMENTS = 128;
// Hue jitter (fraction of the color wheel, ±) from the per-planet seed.
const HUE_JITTER = 0.04;
const HZ_COLOR = 0x2faf64;
// Gradient ends, raw sRGB: orange = too hot (inner edge), blue = too cold
// (outer edge). Aesthetic choice, not data.
const HZ_HOT_COLOR = 0xe8742a;
const HZ_COLD_COLOR = 0x4aa8e8;

const urlParams = new URLSearchParams(globalThis.location?.search ?? '');
const exposeBridge = urlParams.get('pdb') === '1';

interface RenderablePlanet {
  record: ExoplanetRecord;
  semiMajorAxisAU: number;
  eccentricity: number;
  inclinationDeg: number | null;
  schematic: boolean;
  radiusAU: number;
  type: PlanetType;
  seed: number;
}

/** Planets with a semi-major axis (the only hard requirement to draw an orbit). */
function renderablePlanets(host: ExoHost, maxA: number): RenderablePlanet[] {
  return host.planets
    .filter((p) => p.pl_orbsmax !== null)
    .map((p) => ({
      record: p,
      semiMajorAxisAU: p.pl_orbsmax!,
      // SPEC §6.7: schematic (flat, dashed) when the inclination is missing;
      // missing eccentricity degrades to a circle (never guessed).
      eccentricity: p.pl_orbeccen ?? 0,
      inclinationDeg: p.pl_orbincl,
      schematic: p.pl_orbincl === null,
      radiusAU: maxA * 0.02 * Math.min(Math.max(Math.cbrt(p.pl_rade ?? 1), 0.6), 2.5),
      type: classifyPlanet(p),
      seed: nameSeed(p.pl_name),
    }));
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
  return planet.schematic ? [maxA * 0.03, maxA * 0.018] : [0, 0];
}

/** Plain 1 px line (the original look), tinted by planet class. */
function SimpleOrbit({ planet, maxA }: { planet: RenderablePlanet; maxA: number }) {
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
  return <primitive object={line} />;
}

/** Screen-space thick line (drei Line2). */
function ThickOrbit({ planet, maxA }: { planet: RenderablePlanet; maxA: number }) {
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
function TrailOrbit({
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

  const ref = useRef<THREE.Line<THREE.BufferGeometry, THREE.ShaderMaterial>>(null);
  useFrame(() => {
    const uniforms = ref.current?.material.uniforms;
    if (uniforms) uniforms.uPlanetAngle!.value = angle();
  });
  return <primitive ref={ref} object={line} />;
}

/** Procedural lit sphere per planet class (planet.vert/.frag). */
function planetMaterial(planet: RenderablePlanet): THREE.ShaderMaterial {
  const [a, b, c] = PLANET_PALETTE[planet.type].map((hex) =>
    new THREE.Color(hex).offsetHSL((planet.seed - 0.5) * 2 * HUE_JITTER, 0, 0),
  );
  return new THREE.ShaderMaterial({
    vertexShader: planetVert,
    fragmentShader: noiseGlsl + planetFrag,
    uniforms: {
      uType: { value: PLANET_TYPE_INDEX[planet.type] },
      uSeed: { value: planet.seed },
      uColorA: { value: a },
      uColorB: { value: b },
      uColorC: { value: c },
    },
  });
}

/**
 * Animates the planets along their Keplerian orbits and (in test mode)
 * publishes the __system bridge. Simulation time advances by the GLOBAL
 * time scale (store, days per real second; 0 = paused — SPEC §6.7).
 */
function PlanetAnimator({
  planets,
  meshes,
  angles,
  hz,
  hzIncl,
}: {
  planets: RenderablePlanet[];
  meshes: React.RefObject<(THREE.Mesh | null)[]>;
  /** Current orbit-plane angle per planet name (read by the trail orbits). */
  angles: React.RefObject<Map<string, number>>;
  hz: HzBounds | null;
  hzIncl: number | null;
}) {
  const tDays = useRef(0);

  useFrame((_, delta) => {
    tDays.current += delta * useGalaxyMapStore.getState().timeScaleDaysPerSecond;
    for (let i = 0; i < planets.length; i++) {
      const mesh = meshes.current[i];
      const p = planets[i]!;
      if (!mesh) continue;
      // No period → the planet rests at periapsis (t=0); period is shown as
      // n/d in the panel, motion is never fabricated.
      const t = p.record.pl_orbper === null ? 0 : tDays.current;
      const { x, y } = orbitPlanePosition(
        p.semiMajorAxisAU,
        p.eccentricity,
        p.record.pl_orbper ?? 1,
        t,
      );
      mesh.position.set(...toSceneCoords(x, y, p.inclinationDeg));
      angles.current.set(p.record.pl_name, planeAngle(x, y));
    }
    if (exposeBridge) {
      (globalThis as Record<string, unknown>).__system = {
        tDays: tDays.current,
        timeScale: useGalaxyMapStore.getState().timeScaleDaysPerSecond,
        hz: hz && { ...hz, inclinationDeg: hzIncl },
        planets: planets.map((p) => ({
          name: p.record.pl_name,
          schematic: p.schematic,
          semiMajorAxisAU: p.semiMajorAxisAU,
          periodDays: p.record.pl_orbper,
          angleDeg:
            p.record.pl_orbper === null
              ? 0
              : orbitAngleDeg(p.semiMajorAxisAU, p.eccentricity, p.record.pl_orbper, tDays.current),
        })),
      };
    }
  });

  return null;
}

/**
 * drei's OrbitControls wraps three-stdlib, which has no `cursorStyle`, so the
 * grab/grabbing cursor (#11) is driven here from the left-button drag.
 */
/* eslint-disable react-hooks/immutability -- imperative cursor style on the canvas element */
function GrabCursor({ overPlanet }: { overPlanet: { current: boolean } }) {
  const el = useThree((s) => s.gl.domElement);
  const dragging = useRef(false);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button === 0) dragging.current = true;
    };
    const cancel = () => {
      dragging.current = false;
    };
    const up = (e: PointerEvent) => {
      if (e.button === 0) cancel();
    };
    // three-stdlib does not capture the pointer: a drag can end outside the
    // canvas, so release is listened on the document.
    const doc = el.ownerDocument;
    el.addEventListener('pointerdown', down);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      el.style.cursor = '';
    };
  }, [el]);
  // Polled per frame: hover comes from R3F handlers, drag from DOM listeners;
  // one writer keeps them consistent.
  useFrame(() => {
    el.style.cursor = canvasCursor(dragging.current, overPlanet.current);
  });
  return null;
}
/* eslint-enable react-hooks/immutability */

/**
 * HZ ring in the median orbital plane. ringGeometry lies in local XY; rotating
 * about X by π/2 − i maps (x, y, 0) to (x, y·sin i, y·cos i), the same plane
 * as `toSceneCoords`. No inclination → flat in XZ, like the schematic orbits.
 */
function HabitableZoneRing({
  hz,
  inclinationDeg,
}: {
  hz: HzBounds;
  inclinationDeg: number | null;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: hzVert,
        fragmentShader: hzFrag,
        uniforms: {
          uInner: { value: hz.innerAU },
          uOuter: { value: hz.outerAU },
          uHot: { value: new THREE.Color().setHex(HZ_HOT_COLOR, THREE.LinearSRGBColorSpace) },
          uMid: { value: new THREE.Color().setHex(HZ_COLOR, THREE.LinearSRGBColorSpace) },
          uCold: { value: new THREE.Color().setHex(HZ_COLD_COLOR, THREE.LinearSRGBColorSpace) },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [hz.innerAU, hz.outerAU],
  );
  useEffect(() => () => material.dispose(), [material]);
  const tilt = Math.PI / 2 - THREE.MathUtils.degToRad(inclinationDeg ?? 0);
  return (
    <mesh rotation={[tilt, 0, 0]} material={material} raycast={() => null}>
      <ringGeometry args={[hz.innerAU, hz.outerAU, 96]} />
    </mesh>
  );
}

/**
 * System View (SPEC §6.7): real-scale orbits in AU around the host star at
 * the origin; star/planet RADII are presentational (real ones would be
 * sub-pixel). Orbit-cam around the star, planets clickable for details.
 */
export function SystemScene() {
  const overPlanet = useRef(false);
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const showHz = useGalaxyMapStore((s) => s.showHabitableZone);
  const selectPlanet = useGalaxyMapStore((s) => s.selectPlanet);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);
  const orbitStyle = useSettingsStore((s) => s.orbitStyle);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const angles = useRef(new Map<string, number>());

  // Host data is a module holder read (already loaded by the entry panel).
  const host = hostname ? getHost(hostname) : null;
  const allPlanets = useMemo(() => {
    if (!host) return [];
    const maxA = Math.max(...host.planets.map((p) => p.pl_orbsmax ?? 0), 0.01);
    return renderablePlanets(host, maxA);
  }, [host]);
  // Type filter hides planet + orbit; the scene scale (maxA) stays that of the
  // whole system so toggling doesn't rescale the view.
  const planets = useMemo(
    () => allPlanets.filter((p) => visibleTypes[p.type]),
    [allPlanets, visibleTypes],
  );
  const materials = useMemo(
    () => new Map(allPlanets.map((p) => [p.record.pl_name, planetMaterial(p)])),
    [allPlanets],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  if (!host || !hostname) return null;
  const maxA = Math.max(...allPlanets.map((p) => p.semiMajorAxisAU), 0.01);
  const starRadius = Math.max((host.st_rad ?? 0) * SUN_RADIUS_AU, maxA * 0.045);
  const hz = hzBoundsAU(host.st_lum);
  const hzIncl = hzInclinationDeg(allPlanets.map((p) => p.inclinationDeg));

  return (
    <Canvas
      camera={{
        position: [maxA * 1.7, maxA * 1.1, maxA * 1.7],
        fov: 50,
        near: maxA / 500,
        far: maxA * 200,
      }}
      gl={{ antialias: true, preserveDrawingBuffer: exposeBridge }}
      onPointerMissed={() => selectPlanet(null)}
    >
      <color attach="background" args={[0x000000]} />
      <HostStar radius={starRadius} teffK={host.st_teff} hostname={hostname} />
      {showHz && hz && <HabitableZoneRing hz={hz} inclinationDeg={hzIncl} />}
      {planets.map((p, i) => (
        <group key={p.record.pl_name}>
          {orbitStyle === 'trail' && (
            <TrailOrbit
              planet={p}
              maxA={maxA}
              angle={() => angles.current.get(p.record.pl_name) ?? 0}
            />
          )}
          {orbitStyle === 'thick' && <ThickOrbit planet={p} maxA={maxA} />}
          {orbitStyle === 'simple' && <SimpleOrbit planet={p} maxA={maxA} />}
          <mesh
            ref={(m) => {
              meshes.current[i] = m;
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectPlanet(p.record.pl_name);
            }}
            onPointerOver={() => (overPlanet.current = true)}
            onPointerOut={() => (overPlanet.current = false)}
          >
            <sphereGeometry args={[p.radiusAU, 48, 24]} />
            <primitive object={materials.get(p.record.pl_name)!} attach="material" />
          </mesh>
        </group>
      ))}
      <PlanetAnimator planets={planets} meshes={meshes} angles={angles} hz={hz} hzIncl={hzIncl} />
      <GrabCursor overPlanet={overPlanet} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={maxA * 0.15}
        maxDistance={maxA * 25}
      />
    </Canvas>
  );
}
