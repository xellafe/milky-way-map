import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getHost, type ExoHost, type ExoplanetRecord } from '../data/exoplanets';
import { hzBoundsAU } from '../lib/habitableZone';
import { classifyPlanet } from '../lib/planetType';
import { orbitAngleDeg, orbitPathPoints, orbitPlanePosition, toSceneCoords } from '../lib/orbit';
import { teffToColor } from '../lib/starColor';
import { useGalaxyMapStore } from '../state/store';

const SUN_RADIUS_AU = 0.00465;
// Presentational palette for planet spheres (orbits are real-scale, BODY
// sizes/colors are not — pscomppars has no planet colors).
const PLANET_COLORS = [
  0x9bb5d4, 0xd4b08c, 0x8cd4a8, 0xd48c9b, 0xb59bd4, 0xd4cf8c, 0x8cc7d4, 0xc4c4c4,
];
const ORBIT_COLOR = 0x5a7aa8;
const HZ_COLOR = 0x2faf64;

const urlParams = new URLSearchParams(globalThis.location?.search ?? '');
const exposeBridge = urlParams.get('pdb') === '1';

interface RenderablePlanet {
  record: ExoplanetRecord;
  semiMajorAxisAU: number;
  eccentricity: number;
  inclinationDeg: number | null;
  schematic: boolean;
  radiusAU: number;
  color: number;
}

/** Planets with a semi-major axis (the only hard requirement to draw an orbit). */
function renderablePlanets(host: ExoHost, maxA: number): RenderablePlanet[] {
  return host.planets
    .filter((p) => p.pl_orbsmax !== null)
    .map((p, i) => ({
      record: p,
      semiMajorAxisAU: p.pl_orbsmax!,
      // SPEC §6.7: schematic (flat, dashed) when the inclination is missing;
      // missing eccentricity degrades to a circle (never guessed).
      eccentricity: p.pl_orbeccen ?? 0,
      inclinationDeg: p.pl_orbincl,
      schematic: p.pl_orbincl === null,
      radiusAU: maxA * 0.02 * Math.min(Math.max(Math.cbrt(p.pl_rade ?? 1), 0.6), 2.5),
      color: PLANET_COLORS[i % PLANET_COLORS.length]!,
    }));
}

function OrbitLine({ planet, maxA }: { planet: RenderablePlanet; maxA: number }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        orbitPathPoints({
          semiMajorAxisAU: planet.semiMajorAxisAU,
          eccentricity: planet.eccentricity,
          inclinationDeg: planet.inclinationDeg,
        }),
        3,
      ),
    );
    const material = planet.schematic
      ? new THREE.LineDashedMaterial({
          color: ORBIT_COLOR,
          dashSize: maxA * 0.03,
          gapSize: maxA * 0.018,
          transparent: true,
          opacity: 0.7,
        })
      : new THREE.LineBasicMaterial({ color: ORBIT_COLOR, transparent: true, opacity: 0.7 });
    const obj = new THREE.Line(geometry, material);
    if (planet.schematic) obj.computeLineDistances();
    return obj;
  }, [planet, maxA]);
  return <primitive object={line} />;
}

/**
 * Animates the planets along their Keplerian orbits and (in test mode)
 * publishes the __system bridge. Simulation time advances by the GLOBAL
 * time scale (store, days per real second; 0 = paused — SPEC §6.7).
 */
function PlanetAnimator({
  planets,
  meshes,
  hz,
}: {
  planets: RenderablePlanet[];
  meshes: React.RefObject<(THREE.Mesh | null)[]>;
  hz: { innerAU: number; outerAU: number } | null;
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
    }
    if (exposeBridge) {
      (globalThis as Record<string, unknown>).__system = {
        tDays: tDays.current,
        timeScale: useGalaxyMapStore.getState().timeScaleDaysPerSecond,
        hz,
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
 * System View (SPEC §6.7): real-scale orbits in AU around the host star at
 * the origin; star/planet RADII are presentational (real ones would be
 * sub-pixel). Orbit-cam around the star, planets clickable for details.
 */
export function SystemScene() {
  const hostname = useGalaxyMapStore((s) => s.systemHostname);
  const showHz = useGalaxyMapStore((s) => s.showHabitableZone);
  const selectPlanet = useGalaxyMapStore((s) => s.selectPlanet);
  const visibleTypes = useGalaxyMapStore((s) => s.visiblePlanetTypes);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

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
    () => allPlanets.filter((p) => visibleTypes[classifyPlanet(p.record)]),
    [allPlanets, visibleTypes],
  );

  if (!host) return null;
  const maxA = Math.max(...allPlanets.map((p) => p.semiMajorAxisAU), 0.01);
  const starRadius = Math.max((host.st_rad ?? 0) * SUN_RADIUS_AU, maxA * 0.045);
  const hz = hzBoundsAU(host.st_lum);

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
      <mesh>
        <sphereGeometry args={[starRadius, 32, 16]} />
        <meshBasicMaterial color={teffToColor(host.st_teff)} />
      </mesh>
      {showHz && hz && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[hz.innerAU, hz.outerAU, 96]} />
          <meshBasicMaterial
            color={HZ_COLOR}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {planets.map((p, i) => (
        <group key={p.record.pl_name}>
          <OrbitLine planet={p} maxA={maxA} />
          <mesh
            ref={(m) => {
              meshes.current[i] = m;
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectPlanet(p.record.pl_name);
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <sphereGeometry args={[p.radiusAU, 24, 12]} />
            <meshBasicMaterial color={p.color} />
          </mesh>
        </group>
      ))}
      <PlanetAnimator planets={planets} meshes={meshes} hz={hz} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={maxA * 0.15}
        maxDistance={maxA * 25}
      />
    </Canvas>
  );
}
