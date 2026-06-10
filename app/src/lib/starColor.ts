/**
 * Presentational tint for a star from its effective temperature — a coarse
 * piecewise blackbody approximation for the System View host sphere only
 * (the galaxy cloud uses the catalog B–V colors from the pipeline).
 * Unknown temperature → neutral white, never guessed further.
 */
export function teffToColor(teffK: number | null): number {
  if (teffK === null || !Number.isFinite(teffK)) return 0xffffff;
  if (teffK < 3700) return 0xffb46b; // M — orange-red
  if (teffK < 5200) return 0xffd2a1; // K — orange
  if (teffK < 6000) return 0xfff4e8; // G — yellow-white
  if (teffK < 7500) return 0xf8f7ff; // F — white
  if (teffK < 10000) return 0xcad8ff; // A — blue-white
  return 0xaabfff; // O/B — blue
}
