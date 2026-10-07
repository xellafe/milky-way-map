import { teffToColor } from './starColor';

export type SpectralLetter = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

/**
 * Representative Teff per spectral class, K. Typical class values (convention);
 * the resulting chip color is an aesthetic choice, not data.
 */
export const SPECTRAL_CHIP_TEFF_K: Record<SpectralLetter, number> = {
  O: 35000,
  B: 15000,
  A: 8500,
  F: 6700,
  G: 5600,
  K: 4400,
  M: 3200,
};

/** `#rrggbb` chip color for a spectral class, via the host-star tint. */
export function spectralChipColor(letter: SpectralLetter): string {
  return '#' + teffToColor(SPECTRAL_CHIP_TEFF_K[letter]).toString(16).padStart(6, '0');
}
