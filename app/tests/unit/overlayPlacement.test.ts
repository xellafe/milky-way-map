import { describe, expect, it } from 'vitest';

import { placeCard, type Area } from '../../src/lib/overlayPlacement';

// Usable area below the search box and above the bottom stack (#23).
const AREA: Area = { left: 0, top: 60, right: 1280, bottom: 640 };
const GAP = 40;
const TOP_OFFSET = -30;

describe('placeCard', () => {
  it('goes right when it fits, left otherwise', () => {
    expect(placeCard(200, 300, 224, 200, AREA, GAP, TOP_OFFSET).side).toBe('right');
    expect(placeCard(1200, 300, 224, 200, AREA, GAP, TOP_OFFSET).side).toBe('left');
  });

  it('goes right when the card exactly fits', () => {
    expect(placeCard(1280 - GAP - 224, 300, 224, 200, AREA, GAP, TOP_OFFSET).side).toBe('right');
  });

  it('when neither side fits, picks the side with more room', () => {
    const area: Area = { ...AREA, right: 1000 };
    // 470 px card at x = 600: 400 px free on the right, 600 on the left.
    expect(placeCard(600, 300, 470, 200, area, GAP, TOP_OFFSET).side).toBe('left');
    // Mirror case: more room on the right.
    expect(placeCard(300, 300, 470, 200, { ...AREA, right: 600 }, GAP, TOP_OFFSET).side).toBe(
      'right',
    );
  });

  it('shifts the card up so its bottom stays inside the area', () => {
    const { shiftY } = placeCard(200, 620, 224, 300, AREA, GAP, TOP_OFFSET);
    expect(620 + TOP_OFFSET + shiftY + 300).toBeLessThanOrEqual(AREA.bottom);
    expect(shiftY).toBeLessThan(0);
  });

  it('shifts the card down so its top stays inside the area', () => {
    const { shiftY } = placeCard(200, 70, 224, 200, AREA, GAP, TOP_OFFSET);
    expect(70 + TOP_OFFSET + shiftY).toBeGreaterThanOrEqual(AREA.top);
  });

  it('does not shift a card that already fits', () => {
    expect(placeCard(200, 300, 224, 200, AREA, GAP, TOP_OFFSET).shiftY).toBe(0);
  });

  it('a card taller than the area wins on top', () => {
    const { shiftY } = placeCard(200, 400, 224, 700, AREA, GAP, TOP_OFFSET);
    expect(400 + TOP_OFFSET + shiftY).toBe(AREA.top);
  });
});
