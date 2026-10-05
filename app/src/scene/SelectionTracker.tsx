import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { getStarCore } from '../data/starCoreStore';
import { overlaySide } from '../lib/overlayPlacement';
import { CARD_GAP_PX, CARD_TOP_OFFSET_PX } from '../lib/selectionGeometry';
import { useGalaxyMapStore } from '../state/store';
import { getSelectionAnchor } from './selectionAnchor';

// Card width before it is measured (first frame): mirrors `w-56` in
// SelectionOverlay (224 px). Human choice (#3).
const FALLBACK_CARD_WIDTH_PX = 224;

// Clearance between the card and the search box / dock, px. Human choice (#3).
const CARD_MARGIN_PX = 8;

/**
 * In-Canvas projector of the selected star onto the overlay's anchor element
 * (#3). Writes `transform`, `visibility` and `data-side` directly on the DOM
 * node: no React state per frame.
 */
export function SelectionTracker() {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());

  useFrame(() => {
    const el = getSelectionAnchor();
    const core = getStarCore();
    const selection = useGalaxyMapStore.getState().selection;
    if (!el || !core || selection?.kind !== 'star') return;

    const i = selection.index * 3;
    const p = v.current.set(core.position[i]!, core.position[i + 1]!, core.position[i + 2]!);
    camera.updateMatrixWorld();
    p.project(camera);
    // Behind the camera or off-screen → hidden (spec §4.2; same culling as
    // StarLabels). `visibility: hidden` also drops the ✕ from the tab order.
    // Behind the camera the transform is left alone (mirrored projection);
    // off-screen it is still written, so it never goes stale.
    if (p.z >= 1) {
      el.style.visibility = 'hidden';
      return;
    }
    const onScreen = Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
    const x = ((p.x + 1) / 2) * size.width;
    const y = ((1 - p.y) / 2) * size.height;

    // The card must not sit under the detail panel: measure it, don't hard-code.
    const panelWidth =
      document.querySelector<HTMLElement>('[data-hud=star-panel]')?.offsetWidth ?? 0;
    const card = el.querySelector<HTMLElement>('[data-hud=selection-card]');
    const cardWidth = card?.offsetWidth || FALLBACK_CARD_WIDTH_PX;
    // Keep the card between the search box and the dock / music player: shift it vertically
    // (individual `translate` property, so it never fights `transform`).
    if (card) {
      const top = document.querySelector('[data-hud=search]')?.getBoundingClientRect().bottom ?? 0;
      const bottom = Math.min(
        ...['dock', 'music-player'].map(
          (hud) =>
            document.querySelector(`[data-hud=${hud}]`)?.getBoundingClientRect().top ?? size.height,
        ),
      );
      const cardTop = y + CARD_TOP_OFFSET_PX;
      const maxShift = bottom - CARD_MARGIN_PX - (cardTop + card.offsetHeight);
      const minShift = top + CARD_MARGIN_PX - cardTop;
      // Top wins if the card is taller than the free band.
      card.style.translate = `0 ${Math.max(Math.min(0, maxShift), minShift).toFixed(1)}px`;
    }
    el.style.visibility = onScreen ? 'visible' : 'hidden';
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.dataset.side = overlaySide(x, cardWidth, CARD_GAP_PX, size.width - panelWidth);
  });

  return null;
}
