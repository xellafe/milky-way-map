/** WebGL2 is the rendering baseline (SPEC §7); callers show a fallback message when absent. */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
