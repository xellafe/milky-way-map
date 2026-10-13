export type LayoutMode = 'desktop' | 'portrait' | 'landscape';

/**
 * Short-side threshold under which a coarse-pointer device is treated as a phone
 * (px, design choice, not data; SPEC §1 / #25). Tablets (short side >= 600) keep
 * the desktop layout.
 */
export const MOBILE_SHORT_SIDE_PX = 600;

/**
 * Phone layout only when the primary pointer is coarse AND the short side is small.
 * Using the short side keeps the mode stable when the on-screen keyboard shrinks the
 * height, and orientation follows the aspect ratio.
 */
export function layoutMode(width: number, height: number, coarse: boolean): LayoutMode {
  if (!coarse || Math.min(width, height) >= MOBILE_SHORT_SIDE_PX) return 'desktop';
  return height >= width ? 'portrait' : 'landscape';
}
