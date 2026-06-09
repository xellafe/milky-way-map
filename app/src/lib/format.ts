/**
 * Locale-aware number formatting for the UI (skill react-i18n-setup: numbers
 * and units go through Intl). Missing values render as the localized "n/d"
 * marker — never a fabricated number (SPEC §0.7, §6.6).
 */

export function formatNumber(
  value: number | null | undefined,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Spectral class code (0..7, SPEC §5.1) → display letter; 7 = unknown → null. */
const SPECTRAL_LETTERS = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const;

export function spectralClassLetter(code: number): string | null {
  return SPECTRAL_LETTERS[code] ?? null;
}

/** Flags bitmask accessors (SPEC §5.1). */
export const FLAG_VARIABLE = 1 << 0;
export const FLAG_MULTIPLE = 1 << 1;
export const FLAG_HAS_EXOPLANETS = 1 << 2;

export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}
