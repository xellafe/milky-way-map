import { formatNumber } from './format';

/** NASA Archive limit flag: 1 = upper limit, -1 = lower limit, 0 = measured. */
export type Lim = -1 | 0 | 1 | null;

/** Display prefix for a limit-flagged value (an upper limit reads "<"). */
export function limitPrefix(lim: Lim): '<' | '>' | '' {
  return lim === 1 ? '<' : lim === -1 ? '>' : '';
}

/** Archive metallicity ratio recognised for the label; anything else is not shown. */
export function metallicityRatioTag(ratio: string | null): '[Fe/H]' | '[M/H]' | null {
  return ratio === '[Fe/H]' || ratio === '[M/H]' ? ratio : null;
}

/** Number with its archive limit prefix and optional unit; null when absent. */
export function formatLimited(
  value: number | null,
  lim: Lim,
  lang: string,
  digits: number,
  unit?: string,
): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const n = formatNumber(value, lang, { maximumSignificantDigits: digits });
  return `${limitPrefix(lim)}${n}${unit ? ` ${unit}` : ''}`;
}
