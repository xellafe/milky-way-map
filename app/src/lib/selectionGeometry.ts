// Selection overlay geometry (#3). Single source for the rings, the callout
// leader and the card placement. All values are px CSS (angles in degrees), centred
// on the star; human design choices (not data).

/** Inner ring radius. */
export const INNER_R = 30;
/** Outer ring radius (Ø 94.5). */
export const OUTER_R = 47.25;
/** Half-extent of the ring box: OUTER_R plus half its 1 px stroke, rounded up. */
export const RING_HALF_PX = 48;

const arcLen = (r: number, deg: number) => ((2 * Math.PI * r * deg) / 360).toFixed(2);
/** Inner ring pattern: dash 40° / gap 5° / dot 5° / gap 10°. */
export const INNER_DASH = [40, 5, 5, 10].map((d) => arcLen(INNER_R, d)).join(' ');
/** Outer ring pattern: dash 6° / gap 4°. */
export const OUTER_DASH = [6, 4].map((d) => arcLen(OUTER_R, d)).join(' ');

/** Callout arc: sits on the outer ring, centred on −45° (upper right). */
const ARC_HALF_SPAN_DEG = 20;
const ARC_CENTER_DEG = -45;
/** Elbow of the 45° leader segment. */
const ELBOW = 51;
/** Card left edge from the star centre: the horizontal leader runs ELBOW → here. */
export const CARD_GAP_PX = 72;
/** The leader enters the card this far below the card top. */
const LEADER_INSET_PX = 12;
/** Card top relative to the star (negative = above); aligns the leader at y = −ELBOW. */
export const CARD_TOP_OFFSET_PX = -(ELBOW + LEADER_INSET_PX);

const pt = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(OUTER_R * Math.cos(a)).toFixed(2)} ${(OUTER_R * Math.sin(a)).toFixed(2)}`;
};

/** Right-side leader: arc, then from its midpoint a 45° segment to the elbow and
 * a horizontal one to the card. Mirrored in CSS for the left side. */
export const CALLOUT_PATH =
  `M ${pt(ARC_CENTER_DEG - ARC_HALF_SPAN_DEG)} A ${OUTER_R} ${OUTER_R} 0 0 1 ${pt(ARC_CENTER_DEG + ARC_HALF_SPAN_DEG)} ` +
  `M ${pt(ARC_CENTER_DEG)} L ${ELBOW} ${-ELBOW} H ${CARD_GAP_PX}`;
