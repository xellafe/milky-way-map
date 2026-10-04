export interface Track {
  src: string;
  /** i18n key of the track title. */
  titleKey: string;
}

export function nextIndex(index: number, length: number): number {
  return (index + 1) % length;
}

export function prevIndex(index: number, length: number): number {
  return (index - 1 + length) % length;
}
