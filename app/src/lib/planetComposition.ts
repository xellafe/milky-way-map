/**
 * Rocky / water-world / gaseous split from the mass-radius curves of
 * Zeng et al. 2019, PNAS 116, 9723 (doi:10.1073/pnas.1812905116).
 * Tables copied verbatim (masses and radii in Earth units) from the author's
 * page https://lweb.cfa.harvard.edu/~lzeng/planetmodels.html :
 *  - rocky: https://lweb.cfa.harvard.edu/~lzeng/tables/massradiusEarthlikeRocky.txt
 *    (Earth-like rocky, 32.5% Fe + 67.5% MgSiO3), subset 0.1-100 Earth masses;
 *  - water: https://lweb.cfa.harvard.edu/~lzeng/tables/massradius_50percentH2O_300K_1mbar.txt
 *    (50% H2O by mass over an Earth-like core, 300 K, 1 mbar radius), whole
 *    table (0.5-64 Earth masses).
 */

export type Composition = 'rocky' | 'water' | 'gaseous';

// data: [mass M_earth, radius R_earth]
const ROCKY: readonly (readonly [number, number])[] = [
  [0.1046, 0.515],
  [0.1393, 0.5625],
  [0.1831, 0.61],
  [0.2402, 0.6608],
  [0.3142, 0.715],
  [0.4093, 0.7725],
  [0.5304, 0.833],
  [0.6835, 0.8964],
  [0.8756, 0.9625],
  [1.115, 1.0309],
  [1.4114, 1.1015],
  [1.7763, 1.1741],
  [2.2233, 1.2485],
  [2.7682, 1.3245],
  [3.4297, 1.4019],
  [4.2296, 1.4806],
  [5.1932, 1.5604],
  [6.3505, 1.6412],
  [7.7363, 1.7228],
  [9.3912, 1.8052],
  [11.3628, 1.8883],
  [13.7066, 1.9719],
  [16.487, 2.0559],
  [19.7797, 2.1404],
  [23.6585, 2.2246],
  [28.152, 2.3063],
  [33.3138, 2.3848],
  [39.2487, 2.4602],
  [46.0693, 2.5325],
  [53.8965, 2.6019],
  [62.8692, 2.6683],
  [73.1339, 2.7319],
  [84.8337, 2.7924],
  [98.1197, 2.8497],
];

// data: [mass M_earth, radius R_earth]
const WATER50: readonly (readonly [number, number])[] = [
  [0.5, 1.018],
  [0.595, 1.07],
  [0.707, 1.125],
  [0.841, 1.182],
  [1, 1.241],
  [1.189, 1.302],
  [1.414, 1.366],
  [1.682, 1.432],
  [2, 1.502],
  [2.828, 1.648],
  [3.364, 1.725],
  [4, 1.805],
  [4.757, 1.888],
  [5.657, 1.974],
  [6.727, 2.062],
  [8, 2.152],
  [9.514, 2.244],
  [11.314, 2.339],
  [13.454, 2.436],
  [16, 2.535],
  [19.027, 2.635],
  [22.627, 2.736],
  [32, 2.938],
  [38.055, 3.038],
  [53.817, 3.231],
  [64, 3.324],
];

/**
 * Log-log interpolation; outside the table the end segment is extended.
 * Deliberate simplification: extrapolated radii are a power-law continuation,
 * not model output; upgrade when the tables are extended past their range.
 */
function interp(table: readonly (readonly [number, number])[], mass: number): number {
  let i = 1;
  while (i < table.length - 1 && mass > table[i]![0]) i++;
  const [m0, r0] = table[i - 1]!;
  const [m1, r1] = table[i]!;
  const t = Math.log(mass / m0) / Math.log(m1 / m0);
  return Math.exp(Math.log(r0) + t * Math.log(r1 / r0));
}

export function rockyRadius(massEarth: number): number {
  return interp(ROCKY, massEarth);
}

export function water50Radius(massEarth: number): number {
  return interp(WATER50, massEarth);
}

/**
 * Composition class of a planet with a measured true mass. Msini and
 * Msini is only a minimum mass, and a mass from a mass-radius relationship is
 * derived from the radius, so the result would be circular; both give null.
 */
export function planetComposition(
  massEarth: number | null,
  radiusEarth: number | null,
  massProv: string | null,
): Composition | null {
  if (massProv !== 'Mass') return null;
  if (massEarth === null || radiusEarth === null) return null;
  if (!(massEarth > 0) || !(radiusEarth > 0)) return null;
  if (radiusEarth <= rockyRadius(massEarth)) return 'rocky';
  return radiusEarth <= water50Radius(massEarth) ? 'water' : 'gaseous';
}
