import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getHost, type ExoHost } from '../data/exoplanets';
import { canvasCursor } from '../lib/canvasCursor';
import { approachTarget, followStep, followViewShift, type MutVec3 } from '../lib/follow';
import { centerShift } from '../lib/sheet';
import { exposeBridge } from '../lib/testBridge';
import { useLayoutMode } from '../lib/viewport';
import { MOBILE_MAX_DPR, prefersReducedMotion } from '../lib/motion';
import { hzBoundsAU, hzInclinationDeg, type HzBounds } from '../lib/habitableZone';
import { nameSeed, PLANET_PALETTE, PLANET_TYPE_INDEX, planeAngle } from '../lib/planetStyle';
import { classifyPlanet } from '../lib/planetType';
import { orbitAngleDeg, orbitPlanePosition, toSceneCoords } from '../lib/orbit';
import hzFrag from '../shaders/hz.frag?raw';
import hzVert from '../shaders/hz.vert?raw';
import noiseGlsl from '../shaders/noise.glsl?raw';
import planetFrag from '../shaders/planet.frag?raw';
import planetVert from '../shaders/planet.vert?raw';
import { useSettingsStore } from '../state/settings';
import { useGalaxyMapStore } from '../state/store';
import { CARD_GAP_PX, CARD_TOP_OFFSET_PX } from '../lib/selectionGeometry';
import { HostStar } from './HostStar';
import { placeAnchor } from './placeAnchor';
import { getSelectionAnchor } from './selectionAnchor';
import { SimpleOrbit, ThickOrbit, TrailOrbit, type RenderablePlanet } from './SystemOrbits';
import { useCachedUsableArea } from './usableArea';

// IAU 2015 nominal solar radius (695 700 km) over 1 AU, AU: data.
const SUN_RADIUS_AU = 0.00465;
// Hue jitter (fraction of the color wheel, ±) from the per-planet seed
// (aesthetic choice, not data).
const HUE_JITTER = 0.04;
// Habitable-zone gradient middle, raw sRGB (aesthetic choice, not data).
const HZ_COLOR = 0x2faf64;
// Gradient ends, raw sRGB: orange = too hot (inner edge), blue = too cold
// (outer edge). Aesthetic choice, not data.
const HZ_HOT_COLOR = 0xe8742a;
const HZ_COLD_COLOR = 0x4aa8e8;
// Planet body radius = maxA · PLANET_RADIUS_FRACTION · clamp(cbrt(Rearth), MIN, MAX);
// all unitless, radii are presentational, not real scale (aesthetic choice, not data).
const PLANET_RADIUS_FRACTION = 0.02;
const PLANET_RADIUS_SCALE_MIN = 0.6;
const PLANET_RADIUS_SCALE_MAX = 2.5;
// Minimum host star radius as a fraction of maxA, unitless: keeps small stars visible
// (aesthetic choice, not data).
const STAR_MIN_RADIUS_FRACTION = 0.045;
// Tessellation of the planet spheres, [width, height] segments (aesthetic choice, not data).
const PLANET_SPHERE_SEGMENTS: [number, number] = [48, 24];
// Tessellation of the habitable-zone ring, segments (aesthetic choice, not data).
const HZ_RING_SEGMENTS = 96;
// Initial camera offset (multiples of maxA, unitless) and field of view (degrees)
// (aesthetic choice, not data).
const CAMERA_POSITION_FACTOR: [number, number, number] = [1.7, 1.1, 1.7];
const CAMERA_FOV_DEG = 50;
// Camera clip planes and orbit zoom limits as fractions of maxA, unitless
// (aesthetic choice, not data).
const CAMERA_NEAR_FACTOR = 1 / 500;
const CAMERA_FAR_FACTOR = 200;
const ORBIT_MIN_DISTANCE_FACTOR = 0.15;
const ORBIT_MAX_DISTANCE_FACTOR = 25;
// Projection-shift gap under which the view snaps to its target, px (aesthetic choice,
// not data): stops the ease from creeping through sub-pixel steps.
const VIEW_SNAP_PX = 0.5;

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
      radiusAU:
        maxA *
        PLANET_RADIUS_FRACTION *
        Math.min(
          Math.max(Math.cbrt(p.pl_rade ?? 1), PLANET_RADIUS_SCALE_MIN),
          PLANET_RADIUS_SCALE_MAX,
        ),
      type: classifyPlanet(p),
      seed: nameSeed(p.pl_name),
    }));
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
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

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
        cameraTarget: controls?.target.toArray() ?? null,
        cameraPosition: camera.position.toArray(),
        timeScale: useGalaxyMapStore.getState().timeScaleDaysPerSecond,
        geometries: gl.info.memory.geometries,
        hz: hz && { ...hz, inclinationDeg: hzIncl },
        planets: planets.map((p) => ({
          name: p.record.pl_name,
          position: meshes.current[planets.indexOf(p)]?.position.toArray() ?? null,
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

/** Mesh of the selected planet, or null (nothing selected, or no mesh: no semi-major axis). */
function selectedPlanetMesh(
  planets: RenderablePlanet[],
  meshes: React.RefObject<(THREE.Mesh | null)[]>,
): THREE.Mesh | null {
  const name = useGalaxyMapStore.getState().selectedPlanet;
  if (!name) return null;
  return meshes.current[planets.findIndex((p) => p.record.pl_name === name)] ?? null;
}

/** Seconds the controls target takes to reach a newly selected planet (aesthetic choice, not data). */
const FOLLOW_APPROACH_S = 1;
// Width of the widest planet card, px: mirrors `.object-card[data-mode='advanced']`
// in index.css (human choice, #23). The view shift keeps this card on screen.
const ADVANCED_CARD_WIDTH_PX = 470;
// Rate of the ease that slides the view to/from the parked position, 1/s. Aesthetic choice.
const VIEW_SLIDE_RATE = 8;

/**
 * Keeps the orbit target on the selected planet (#10): eased approach, then a
 * per-frame lock with the camera translated by the same delta. It also shifts
 * the projection (setViewOffset) when the Advanced card would not fit beside a
 * centred planet; this changes picking and PlanetTracker's projection too. The
 * shift is kept on deselect and dies with the Canvas. Must be mounted after
 * PlanetAnimator so it reads this frame's planet positions.
 * Phone (#25): the view is always centred on the area the sheet leaves free instead
 * (both axes), as in the galaxy view.
 */
function PlanetFollow({
  planets,
  meshes,
}: {
  planets: RenderablePlanet[];
  meshes: React.RefObject<(THREE.Mesh | null)[]>;
}) {
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const run = useRef<{ name: string; start: MutVec3; elapsed: number } | null>(null);
  // Per-frame scratch tuples (reused so the follow loop allocates nothing, #46).
  const posBuf = useRef<MutVec3>([0, 0, 0]);
  const targetBuf = useRef<MutVec3>([0, 0, 0]);
  const camBuf = useRef<MutVec3>([0, 0, 0]);
  const nextBuf = useRef<MutVec3>([0, 0, 0]);
  const mobile = useLayoutMode() !== 'desktop';
  const readAreaCached = useCachedUsableArea();
  // Applied and wanted projection shift, px (#23 AC7); y stays 0 on desktop.
  const viewShift = useRef({ x: 0, y: 0 });
  const wantShift = useRef({ x: 0, y: 0 });
  const lastWidth = useRef(size.width);

  useFrame((_, delta) => {
    const name = useGalaxyMapStore.getState().selectedPlanet;
    const mesh = selectedPlanetMesh(planets, meshes);
    if (mobile) {
      // The window moves opposite to the picture: +x moves the scene left.
      const c = centerShift(readAreaCached(size.width, size.height), size.width, size.height);
      wantShift.current.x = -c.x;
      wantShift.current.y = -c.y;
    } else if (mesh) {
      // Recomputed only while a planet is followed: on deselect the view stays put.
      wantShift.current.x = followViewShift(
        readAreaCached(size.width, size.height),
        size.width,
        ADVANCED_CARD_WIDTH_PX,
        CARD_GAP_PX,
      );
      wantShift.current.y = 0;
    } else if (lastWidth.current !== size.width) {
      // The parked shift was computed for another viewport width; park the view at the centre.
      wantShift.current.x = 0;
      wantShift.current.y = 0;
    }
    lastWidth.current = size.width;
    const gapX = wantShift.current.x - viewShift.current.x;
    const gapY = wantShift.current.y - viewShift.current.y;
    if (prefersReducedMotion() || Math.hypot(gapX, gapY) < VIEW_SNAP_PX) {
      viewShift.current.x = wantShift.current.x;
      viewShift.current.y = wantShift.current.y;
    } else {
      const k = Math.min(1, delta * VIEW_SLIDE_RATE);
      viewShift.current.x += gapX * k;
      viewShift.current.y += gapY * k;
    }
    if (viewShift.current.x === 0 && viewShift.current.y === 0) {
      if (camera.view?.enabled) camera.clearViewOffset();
    } else {
      camera.setViewOffset(
        size.width,
        size.height,
        viewShift.current.x,
        viewShift.current.y,
        size.width,
        size.height,
      );
    }
    if (exposeBridge) {
      const bridge = (globalThis as Record<string, unknown>).__system as
        | { viewShiftPx?: number }
        | undefined;
      if (bridge) bridge.viewShiftPx = viewShift.current.x;
    }
    if (!controls || !name || !mesh) {
      run.current = null;
      return;
    }
    if (run.current?.name !== name) {
      run.current = { name, start: controls.target.toArray(), elapsed: 0 };
    }
    const r = run.current;
    r.elapsed += delta;
    const dur = prefersReducedMotion() ? 0 : FOLLOW_APPROACH_S;
    const t = dur === 0 ? 1 : Math.min(r.elapsed / dur, 1);
    const pos = mesh.position.toArray(posBuf.current);
    const next = t < 1 ? approachTarget(r.start, pos, t, nextBuf.current) : pos;
    const moved = followStep(
      camera.position.toArray(camBuf.current),
      controls.target.toArray(targetBuf.current),
      next,
      camBuf.current,
    );
    camera.position.fromArray(moved);
    controls.target.fromArray(next);
    if (exposeBridge) {
      const bridge = (globalThis as Record<string, unknown>).__system as {
        cameraTarget?: number[];
      };
      if (bridge) bridge.cameraTarget = [...next];
    }
  });
  return null;
}

/**
 * Projects the selected planet onto the card's anchor, like SelectionTracker
 * does for stars. A planet without a mesh (no semi-major axis) has no position:
 * its card sits against the right edge of the usable area instead. Mounted
 * after PlanetAnimator so it reads this frame's positions. In test mode it also
 * publishes where the followed planet is on screen (`followedScreen`).
 */
function PlanetTracker({
  planets,
  meshes,
}: {
  planets: RenderablePlanet[];
  meshes: React.RefObject<(THREE.Mesh | null)[]>;
}) {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());
  const readArea = useCachedUsableArea();

  useFrame(() => {
    const el = getSelectionAnchor();
    const name = useGalaxyMapStore.getState().selectedPlanet;
    const mesh = selectedPlanetMesh(planets, meshes);
    if (exposeBridge) {
      const bridge = (globalThis as Record<string, unknown>).__system as
        | { followedScreen?: [number, number] | null }
        | undefined;
      if (bridge) {
        camera.updateMatrixWorld();
        const q = mesh ? v.current.copy(mesh.position).project(camera) : null;
        bridge.followedScreen = q && [((q.x + 1) / 2) * size.width, ((1 - q.y) / 2) * size.height];
      }
    }
    // The phone card is not anchored: there is no element to place.
    if (!el || !name) return;
    if (!mesh) {
      const area = readArea(size.width, size.height);
      placeAnchor(el, area.right + CARD_GAP_PX, area.top - CARD_TOP_OFFSET_PX, true, area);
      return;
    }
    camera.updateMatrixWorld();
    const p = v.current.copy(mesh.position).project(camera);
    // Behind the camera the transform is left alone (mirrored projection).
    if (p.z >= 1) {
      el.style.visibility = 'hidden';
      return;
    }
    const onScreen = Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
    const x = ((p.x + 1) / 2) * size.width;
    const y = ((1 - p.y) / 2) * size.height;
    placeAnchor(el, x, y, onScreen, readArea(size.width, size.height));
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
      <ringGeometry args={[hz.innerAU, hz.outerAU, HZ_RING_SEGMENTS]} />
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
  const mobile = useLayoutMode() !== 'desktop';
  const { allPlanets, maxA } = useMemo(() => {
    if (!host) return { allPlanets: [], maxA: 0 };
    const scale = Math.max(...host.planets.map((p) => p.pl_orbsmax ?? 0), 0.01);
    return { allPlanets: renderablePlanets(host, scale), maxA: scale };
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
  const starRadius = Math.max((host.st_rad ?? 0) * SUN_RADIUS_AU, maxA * STAR_MIN_RADIUS_FRACTION);
  const hz = hzBoundsAU(host.st_lum);
  const hzIncl = hzInclinationDeg(allPlanets.map((p) => p.inclinationDeg));

  return (
    // R3F leaves the <canvas> at the 300x150 default until its first resize
    // measure; filling the wrapper meanwhile keeps the canvas from sitting in
    // the top-left corner under the star panel (#23) and losing pointer input.
    <Canvas
      className="[&_canvas]:size-full"
      // Desktop sets none: the Canvas default ([1, 2]) applies.
      dpr={mobile ? [1, MOBILE_MAX_DPR] : undefined}
      camera={{
        position: CAMERA_POSITION_FACTOR.map((f) => maxA * f) as [number, number, number],
        fov: CAMERA_FOV_DEG,
        near: maxA * CAMERA_NEAR_FACTOR,
        far: maxA * CAMERA_FAR_FACTOR,
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
              selectPlanet({ name: p.record.pl_name, type: p.type });
            }}
            onPointerOver={() => (overPlanet.current = true)}
            onPointerOut={() => (overPlanet.current = false)}
          >
            <sphereGeometry args={[p.radiusAU, ...PLANET_SPHERE_SEGMENTS]} />
            <primitive object={materials.get(p.record.pl_name)!} attach="material" />
          </mesh>
        </group>
      ))}
      <PlanetAnimator planets={planets} meshes={meshes} angles={angles} hz={hz} hzIncl={hzIncl} />
      <PlanetFollow planets={planets} meshes={meshes} />
      <PlanetTracker planets={planets} meshes={meshes} />
      <GrabCursor overPlanet={overPlanet} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={maxA * ORBIT_MIN_DISTANCE_FACTOR}
        maxDistance={maxA * ORBIT_MAX_DISTANCE_FACTOR}
      />
    </Canvas>
  );
}
