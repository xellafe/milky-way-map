import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { getStarCore } from '../data/starCoreStore';
import { placeCard } from '../lib/overlayPlacement';
import { CARD_GAP_PX, CARD_TOP_OFFSET_PX } from '../lib/selectionGeometry';
import { useGalaxyMapStore } from '../state/store';
import { getSelectionAnchor } from './selectionAnchor';
import { readUsableArea } from './usableArea';

// Card width before it is measured (first frame): the Base width of ObjectCard
// (224 px). Human choice (#23).
const FALLBACK_CARD_WIDTH_PX = 224;

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

    // Measured every frame: the card changes size (Base/Advanced) and the HUD reflows.
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
    el.style.visibility = onScreen ? 'visible' : 'hidden';
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.dataset.side = side;
  });

  return null;
}
