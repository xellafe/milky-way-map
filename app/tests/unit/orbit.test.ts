import { describe, expect, it } from 'vitest';

import { hzBoundsAU } from '../../src/lib/habitableZone';
import {
  orbitAngleDeg,
  orbitPathPoints,
  orbitPlanePosition,
  solveEccentricAnomaly,
  toSceneCoords,
} from '../../src/lib/orbit';
import { teffToColor } from '../../src/lib/starColor';

describe('solveEccentricAnomaly', () => {
  it('is the identity for circular orbits (e = 0)', () => {
    expect(solveEccentricAnomaly(1.234, 0)).toBeCloseTo(1.234, 9);
  });

  it('satisfies Kepler’s equation for eccentric orbits', () => {
    for (const e of [0.1, 0.5, 0.9]) {
      for (const M of [0.3, Math.PI / 2, 3, 5.5]) {
        const E = solveEccentricAnomaly(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 7);
      }
    }
  });
});

describe('orbitPlanePosition', () => {
  it('circular orbit: starts on +x and is at +y after a quarter period', () => {
    const p0 = orbitPlanePosition(2, 0, 100, 0);
    expect(p0.x).toBeCloseTo(2, 9);
    expect(p0.y).toBeCloseTo(0, 9);
    const pq = orbitPlanePosition(2, 0, 100, 25);
    expect(pq.x).toBeCloseTo(0, 6);
    expect(pq.y).toBeCloseTo(2, 6);
  });

  it('one full period returns to the start (period correctness)', () => {
    const a = orbitPlanePosition(1.5, 0.3, 11.18465, 3);
    const b = orbitPlanePosition(1.5, 0.3, 11.18465, 3 + 11.18465);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it('eccentric orbit: periapsis a(1-e) at t=0, apoapsis a(1+e) at half period', () => {
    const peri = orbitPlanePosition(1, 0.5, 10, 0);
    expect(Math.hypot(peri.x, peri.y)).toBeCloseTo(0.5, 6);
    const apo = orbitPlanePosition(1, 0.5, 10, 5);
    expect(Math.hypot(apo.x, apo.y)).toBeCloseTo(1.5, 6);
  });
});

describe('orbitAngleDeg', () => {
  it('advances by the expected fraction of a revolution', () => {
    // Circular orbit, P=4 days: after 1 day → 90°.
    expect(orbitAngleDeg(1, 0, 4, 0)).toBeCloseTo(0, 6);
    expect(orbitAngleDeg(1, 0, 4, 1)).toBeCloseTo(90, 5);
    expect(orbitAngleDeg(1, 0, 4, 3)).toBeCloseTo(270, 5);
  });
});

describe('toSceneCoords', () => {
  it('no inclination → flat in the XZ plane (schematic)', () => {
    expect(toSceneCoords(1, 2, null)).toEqual([1, 0, 2]);
  });

  it('90° inclination → edge-on (orbit in the XY plane)', () => {
    const [x, y, z] = toSceneCoords(1, 2, 90);
    expect(x).toBe(1);
    expect(y).toBeCloseTo(2, 9);
    expect(z).toBeCloseTo(0, 9);
  });
});

describe('orbitPathPoints', () => {
  it('produces a closed path with all points on the ellipse', () => {
    const pts = orbitPathPoints(
      { semiMajorAxisAU: 1, eccentricity: 0.3, inclinationDeg: null },
      64,
    );
    expect(pts.length).toBe(65 * 3);
    expect(pts[0]).toBeCloseTo(pts[64 * 3]!, 9); // closed
    // Focus-centred radius must stay within [a(1-e), a(1+e)].
    for (let i = 0; i <= 64; i++) {
      const r = Math.hypot(pts[i * 3]!, pts[i * 3 + 2]!);
      // Float32Array storage: tolerance at single precision, not double.
      expect(r).toBeGreaterThanOrEqual(0.7 - 1e-6);
      expect(r).toBeLessThanOrEqual(1.3 + 1e-6);
    }
  });
});

describe('hzBoundsAU', () => {
  it('matches the pipeline model for the Sun (log L = 0)', () => {
    const hz = hzBoundsAU(0)!;
    expect(hz.innerAU).toBeCloseTo(Math.sqrt(1 / 1.1), 9);
    expect(hz.outerAU).toBeCloseTo(Math.sqrt(1 / 0.53), 9);
  });

  it('is consistent with the fixture in_hz flags (TRAPPIST-1)', () => {
    // st_lum from the fixture; planet b (a=0.01154) is NOT in HZ, e (0.02925) IS.
    const hz = hzBoundsAU(-3.25727)!;
    expect(0.01154 < hz.innerAU).toBe(true);
    expect(0.02925 >= hz.innerAU && 0.02925 <= hz.outerAU).toBe(true);
  });

  it('returns null when the luminosity is missing (never guessed)', () => {
    expect(hzBoundsAU(null)).toBeNull();
  });
});

describe('teffToColor', () => {
  it('maps cool stars red-ish, hot stars blue-ish, unknown to white', () => {
    expect(teffToColor(2566)).toBe(0xffb46b);
    expect(teffToColor(30000)).toBe(0xaabfff);
    expect(teffToColor(null)).toBe(0xffffff);
  });
});
