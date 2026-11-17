import type { TFunction } from 'i18next';

/**
 * Joins a formatted value and its unit through the locale (`units.valueUnit`), so each language
 * owns the separator (French uses a no-break space). `null` stays `null`: callers show `n/a`.
 */
export function withUnit(t: TFunction, value: string | null, unit: string): string | null {
  return value === null ? null : t('units.valueUnit', { value, unit });
}
