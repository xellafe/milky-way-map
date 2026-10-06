import { describe, expect, it } from 'vitest';
import { planetComposition, rockyRadius, water50Radius } from '../../src/lib/planetComposition';

describe('planetComposition', () => {
  it('classifies at 5 Earth masses between the Zeng curves', () => {
    expect(planetComposition(5, 0.95 * rockyRadius(5), 'Mass')).toBe('rocky');
    expect(planetComposition(5, (rockyRadius(5) + water50Radius(5)) / 2, 'Mass')).toBe('water');
    expect(planetComposition(5, 1.1 * water50Radius(5), 'Mass')).toBe('gaseous');
  });

  it('classifies Neptune and Jupiter as gaseous', () => {
    expect(planetComposition(17.1, 3.88, 'Mass')).toBe('gaseous');
    expect(planetComposition(317.8, 11.2, 'Mass')).toBe('gaseous');
  });

  it('returns null unless the mass is a measured true mass', () => {
    const r = 0.95 * rockyRadius(5);
    expect(planetComposition(5, r, 'Msini')).toBeNull();
    expect(planetComposition(5, r, 'M-R relationship')).toBeNull();
    expect(planetComposition(5, r, null)).toBeNull();
  });

  it('returns null for missing or invalid mass or radius', () => {
    for (const bad of [null, 0, -1, NaN]) {
      expect(planetComposition(bad, 1, 'Mass')).toBeNull();
      expect(planetComposition(5, bad, 'Mass')).toBeNull();
    }
  });

  it('has increasing curves with water above rocky', () => {
    const masses = [0.5, 1, 5, 20];
    for (let i = 0; i < masses.length; i++) {
      expect(water50Radius(masses[i]!)).toBeGreaterThan(rockyRadius(masses[i]!));
      if (i > 0) {
        expect(rockyRadius(masses[i]!)).toBeGreaterThan(rockyRadius(masses[i - 1]!));
        expect(water50Radius(masses[i]!)).toBeGreaterThan(water50Radius(masses[i - 1]!));
      }
    }
  });
});
