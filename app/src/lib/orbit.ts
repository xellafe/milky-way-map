/**
 * Keplerian orbit math for the System View (SPEC §6.7). Pure functions,
 * unit-tested. Orbits are REAL-SCALE in AU (semi-major axis from
 * pl_orbsmax); the host star sits at the ellipse FOCUS, not its center.
 *
 * 3D convention (documented limitation): pscomppars provides the inclination
 * `pl_orbincl` but neither Ω (ascending node) nor ω (argument of periapsis),
 * so the full 3D orientation is NOT determinable from the data. When the
 * inclination is present we tilt the orbit plane around the view X axis by
 * that angle (i = 0° → face-on in the XZ "table" plane, i = 90° → edge-on);
 * when it is absent the orbit is drawn SCHEMATIC: flat in the XZ plane and
 * dashed (SPEC §6.7), with eccentricity 0 when that is missing too.
 */

export interface OrbitShape {
  semiMajorAxisAU: number;
  eccentricity: number;
  /** Degrees, or null → schematic flat orbit. */
  inclinationDeg: number | null;
}

/**
 * Solve Kepler's equation E - e·sinE = M for the eccentric anomaly via
 * Newton-Raphson (converges in a handful of iterations for e < 1).
 */
export function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  const e = Math.min(Math.max(eccentricity, 0), 0.99);
  let E = e < 0.8 ? meanAnomalyRad : Math.PI;
  for (let i = 0; i < 12; i++) {
    const delta = (E - e * Math.sin(E) - meanAnomalyRad) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }
  return E;
}

/**
 * Position on the orbit plane at time tDays (periapsis at t=0 on +x), with
 * the FOCUS (host star) at the origin. Returns {x, y} in AU.
 */
export function orbitPlanePosition(
  semiMajorAxisAU: number,
  eccentricity: number,
  periodDays: number,
  tDays: number,
): { x: number; y: number } {
  const e = Math.min(Math.max(eccentricity, 0), 0.99);
  const M = 2 * Math.PI * ((tDays / periodDays) % 1);
  const E = solveEccentricAnomaly(M, e);
  // Focus-centred coordinates straight from the eccentric anomaly.
  return {
    x: semiMajorAxisAU * (Math.cos(E) - e),
    y: semiMajorAxisAU * Math.sqrt(1 - e * e) * Math.sin(E),
  };
}

/** Orbit-plane (x, y) → 3D scene [x, y, z] applying the inclination tilt. */
export function toSceneCoords(
  x: number,
  y: number,
  inclinationDeg: number | null,
): [number, number, number] {
  const incl = ((inclinationDeg ?? 0) * Math.PI) / 180;
  return [x, y * Math.sin(incl), y * Math.cos(incl)];
}

/** Current angle along the orbit in degrees [0, 360) — used by the e2e bridge. */
export function orbitAngleDeg(
  semiMajorAxisAU: number,
  eccentricity: number,
  periodDays: number,
  tDays: number,
): number {
  const { x, y } = orbitPlanePosition(semiMajorAxisAU, eccentricity, periodDays, tDays);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Sampled closed path of the orbit ellipse as scene-space xyz triplets
 * (segments+1 points, last == first), focus at the origin.
 */
export function orbitPathPoints(shape: OrbitShape, segments = 128): Float32Array {
  const e = Math.min(Math.max(shape.eccentricity, 0), 0.99);
  const points = new Float32Array((segments + 1) * 3);
  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * 2 * Math.PI;
    const x = shape.semiMajorAxisAU * (Math.cos(E) - e);
    const y = shape.semiMajorAxisAU * Math.sqrt(1 - e * e) * Math.sin(E);
    const [sx, sy, sz] = toSceneCoords(x, y, shape.inclinationDeg);
    points[s * 3] = sx;
    points[s * 3 + 1] = sy;
    points[s * 3 + 2] = sz;
  }
  return points;
}
