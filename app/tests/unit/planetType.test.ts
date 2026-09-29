import { describe, expect, it } from 'vitest';
import { classifyPlanet } from '../../src/lib/planetType';

describe('classifyPlanet', () => {
  it('classifies by radius at the 1.6 / 4 R⊕ boundaries', () => {
    expect(classifyPlanet({ pl_rade: 1.0, pl_bmasse: null })).toBe('rocky');
    expect(classifyPlanet({ pl_rade: 1.6, pl_bmasse: null })).toBe('subNeptune');
    expect(classifyPlanet({ pl_rade: 3.99, pl_bmasse: null })).toBe('subNeptune');
    expect(classifyPlanet({ pl_rade: 4, pl_bmasse: null })).toBe('giant');
  });

  it('prefers the radius over the mass when both are known', () => {
    expect(classifyPlanet({ pl_rade: 1.1, pl_bmasse: 500 })).toBe('rocky');
  });

  it('falls back to the mass at the 3 / 15 M⊕ boundaries', () => {
    expect(classifyPlanet({ pl_rade: null, pl_bmasse: 1.07 })).toBe('rocky');
    expect(classifyPlanet({ pl_rade: null, pl_bmasse: 3 })).toBe('subNeptune');
    expect(classifyPlanet({ pl_rade: null, pl_bmasse: 15 })).toBe('giant');
  });

  it('never guesses without radius and mass', () => {
    expect(classifyPlanet({ pl_rade: null, pl_bmasse: null })).toBe('unknown');
  });
});
