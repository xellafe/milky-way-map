import { readFlag, writeFlag } from './localFlag';

export const WELCOME_DISMISSED_KEY = 'galaxy-map-welcome-dismissed';

export function isWelcomeDismissed(): boolean {
  return readFlag(WELCOME_DISMISSED_KEY);
}

export function setWelcomeDismissed(dismissed: boolean): void {
  writeFlag(WELCOME_DISMISSED_KEY, dismissed);
}
