export interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where the selection card goes (#23): on the right of the star if it fits
 * inside `area`, else on the left, else on the side with more room. `shiftY`
 * moves it vertically to stay between `area.top` and `area.bottom`; the top
 * wins when the card is taller than the area.
 */
export function placeCard(
  anchorX: number,
  anchorY: number,
  cardW: number,
  cardH: number,
  area: Area,
  gap: number,
  topOffset: number,
): { side: 'left' | 'right'; shiftY: number } {
  const roomRight = area.right - anchorX - gap;
  const roomLeft = anchorX - gap - area.left;
  const side =
    roomRight >= cardW
      ? 'right'
      : roomLeft >= cardW
        ? 'left'
        : roomLeft > roomRight
          ? 'left'
          : 'right';
  const cardTop = anchorY + topOffset;
  const maxShift = area.bottom - (cardTop + cardH);
  const minShift = area.top - cardTop;
  return { side, shiftY: Math.max(Math.min(0, maxShift), minShift) };
}
