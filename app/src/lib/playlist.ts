export interface Track {
  src: string;
  title: string;
}

// Leading track number plus its separator ("01 - ", "01_", "01.", "1 "); a name that is
// only a number has nothing after it, so it keeps the number as its title.
const NUMBER_PREFIX = /^\d+(?:\s*[-._]\s*|\s+)(?=\S)/;

function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function titleOf(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(NUMBER_PREFIX, '')
    .replaceAll('_', ' ');
}

/** `files` maps import.meta.glob module paths to URLs; order is by file name, numeric-aware. */
export function buildPlaylist(files: Record<string, string>): Track[] {
  return Object.entries(files)
    .map(([path, src]) => ({ name: fileName(path), src }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map(({ name, src }) => ({ src, title: titleOf(name) }));
}

export function nextIndex(index: number, length: number): number {
  return (index + 1) % length;
}

export function prevIndex(index: number, length: number): number {
  return (index - 1 + length) % length;
}
