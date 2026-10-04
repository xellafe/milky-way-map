// Storage can be missing or throw (private mode, blocked cookies): flags then
// read as false and writes are dropped instead of breaking the app (SPEC §10).
export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Persistence is best-effort; see readFlag.
  }
}
