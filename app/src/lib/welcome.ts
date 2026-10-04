export const WELCOME_DISMISSED_KEY = 'galaxy-map-welcome-dismissed';

// Storage can be missing or throw (private mode, blocked cookies): the dialog
// then simply shows on every visit instead of breaking the app (SPEC §10).
export function isWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWelcomeDismissed(dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
    else localStorage.removeItem(WELCOME_DISMISSED_KEY);
  } catch {
    // Persistence is best-effort; see isWelcomeDismissed.
  }
}
