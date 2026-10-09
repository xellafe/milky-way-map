import { placeCard } from '../lib/overlayPlacement';
import { CARD_GAP_PX, CARD_TOP_OFFSET_PX } from '../lib/selectionGeometry';
import { readUsableArea } from './usableArea';

// Card width before it is measured (first frame): the Base width of ObjectCard
// (224 px). Human choice (#23).
const FALLBACK_CARD_WIDTH_PX = 224;

/**
 * Writes the anchor's screen position and the card placement straight on the
 * DOM (no React state per frame). Shared by the star and planet trackers.
 * Measured every frame: the card changes size (Base/Advanced) and the HUD reflows.
 */
export function placeAnchor(
  el: HTMLElement,
  x: number,
  y: number,
  visible: boolean,
  size: { width: number; height: number },
): void {
  const slot = el.querySelector<HTMLElement>('[data-hud=selection-slot]');
  const area = readUsableArea(size.width, size.height);
  const { side, shiftY } = placeCard(
    x,
    y,
    slot?.offsetWidth || FALLBACK_CARD_WIDTH_PX,
    slot?.offsetHeight ?? 0,
    area,
    CARD_GAP_PX,
    CARD_TOP_OFFSET_PX,
  );
  // Individual `translate` property, so it never fights `transform`.
  if (slot) {
    slot.style.translate = `0 ${shiftY.toFixed(1)}px`;
    // A card taller than the area scrolls inside instead of overflowing it.
    slot.style.setProperty('--card-max-h', `${Math.max(area.bottom - area.top, 0)}px`);
  }
  el.style.visibility = visible ? 'visible' : 'hidden';
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  el.dataset.side = side;
}
