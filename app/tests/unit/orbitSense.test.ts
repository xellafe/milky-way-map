import { describe, expect, it } from 'vitest';
import { orbitSense } from '../../src/lib/orbitSense';

describe('orbitSense', () => {
  it('uses the true obliquity psi', () => {
    expect(orbitSense(10, 0, null, null)).toBe('prograde');
    expect(orbitSense(120, 0, null, null)).toBe('retrograde');
  });

  it('falls back to the projected obliquity lambda', () => {
    expect(orbitSense(null, null, -150, 0)).toBe('retrograde');
  });

  it('prefers psi over lambda', () => {
    expect(orbitSense(10, 0, -150, 0)).toBe('prograde');
  });

  it('returns null when ambiguous, limited or absent', () => {
    expect(orbitSense(90, 0, null, null)).toBeNull();
    expect(orbitSense(10, 1, null, null)).toBeNull();
    expect(orbitSense(null, null, null, null)).toBeNull();
  });

  it('does not let lambda decide when a measured psi is exactly 90 deg', () => {
    expect(orbitSense(90, 0, 30, 0)).toBeNull();
  });

  it('lets lambda decide when psi is only a limit (HAT-P-36 b)', () => {
    expect(orbitSense(63, 1, -14, 0)).toBe('prograde');
  });
});
