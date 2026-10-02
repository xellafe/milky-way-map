/**
 * Side of the selected star where the floating overlay goes (#3): right of
 * the star if the card fits before `rightLimit` (viewport width minus the
 * detail panel, when open), otherwise left.
 */
export function overlaySide(
  starX: number,
  cardWidth: number,
  gap: number,
  rightLimit: number,
): 'right' | 'left' {
  return starX + gap + cardWidth <= rightLimit ? 'right' : 'left';
}
