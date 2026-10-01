/**
 * Module holder for the selection overlay's root element (#3). The in-Canvas
 * tracker writes its transform every frame straight on the DOM node, so the
 * position never goes through React state.
 */
let anchor: HTMLElement | null = null;

export function setSelectionAnchor(el: HTMLElement | null): void {
  anchor = el;
}

export function getSelectionAnchor(): HTMLElement | null {
  return anchor;
}
