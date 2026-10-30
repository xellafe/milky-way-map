/* eslint-disable react-hooks/immutability --
   GPU picking is inherently imperative three.js: it must save/mutate/restore
   renderer state (render target, clear color, autoClear, cursor) around the
   off-screen ID render. The mutations are frame-scoped and fully restored. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getStarCore, getStarGeometry } from '../data/starCoreStore';
import { canvasCursor } from '../lib/canvasCursor';
import { createLatestOnly, pickMinPx, shouldPickHover } from '../lib/starPick';
import { isCoarsePointer } from '../lib/viewport';
import starPickFrag from '../shaders/star-pick.frag?raw';
import starPickVert from '../shaders/star-pick.vert?raw';
import { useSettingsStore } from '../state/settings';
import { useGalaxyMapStore } from '../state/store';
import { STAR_DIST_EXP, STAR_MAX_PX, STAR_PIXEL_SCALE } from './StarCloud';

const CLICK_MAX_DRAG_PX = 5; // pointerdown→up movement below this = click, not a look-drag
const NO_STAR = 0xffffff; // clear color: ids >= count mean "nothing"

/**
 * GPU picking (skill three-points-shader): a second Points sharing the SAME
 * BufferGeometry renders star indices as 24-bit colors into a 1×1 render
 * target via camera.setViewOffset, reading back the pixel under the cursor.
 * Runs at most once per frame, when the pointer moved, clicked, or (mouse only,
 * ~10 Hz) the camera pose changed under a resting pointer (#45). Hover reads
 * back asynchronously to avoid a GPU stall; click reads synchronously.
 * Depth testing is enabled so the nearest star wins in dense regions.
 * Geometry comes from starCoreStore, not props (see store docs).
 */
export function StarPicking() {
  const geometry = getStarGeometry();
  const { gl, camera, size } = useThree();
  const setHoveredStar = useGalaxyMapStore((s) => s.setHoveredStar);
  const selectStar = useGalaxyMapStore((s) => s.selectStar);

  const pointer = useRef({
    x: 0,
    y: 0,
    moved: false,
    inside: false, // pointer is over the canvas
    touch: false, // last pointer event was a touch
    inFlight: false, // an async hover read is pending
    lastPickMs: 0,
    downX: 0,
    downY: 0,
    down: false,
    click: null as { x: number; y: number } | null,
    multiTouch: false, // two pointers were down during this gesture: never a click
    dragging: false, // left button held on the canvas: CameraControls look-drag
    over: false, // hovering a star
  });

  const pickTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: true,
      }),
    [],
  );

  const pickScene = useMemo(() => {
    if (!geometry) return null;
    const minPx = pickMinPx(isCoarsePointer(), gl.getPixelRatio());
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: starPickVert,
      fragmentShader: starPickFrag,
      uniforms: {
        uPixelScale: {
          value: STAR_PIXEL_SCALE * Math.min(globalThis.devicePixelRatio ?? 1, gl.getPixelRatio()),
        },
        // GLSL clamp(min > max) is undefined: never let the max fall below the min.
        uMaxPx: { value: Math.max(STAR_MAX_PX, minPx) },
        uSizeGamma: { value: useSettingsStore.getState().sizeGamma },
        uDistExp: { value: STAR_DIST_EXP },
        uPickMinPx: { value: minPx },
      },
      depthTest: true,
      depthWrite: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(points);
    return { scene, material };
  }, [geometry, gl]);

  const latest = useMemo(() => createLatestOnly(), []);
  // Camera pose at the last hover request; a difference triggers a camera-driven re-pick.
  const lastPose = useMemo(
    () => ({ world: new THREE.Matrix4(), proj: new THREE.Matrix4(), set: false }),
    [],
  );
  const asyncUnsupported = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    const updateCursor = () => {
      el.style.cursor = canvasCursor(pointer.current.dragging, pointer.current.over);
    };
    const onMove = (e: PointerEvent) => {
      pointer.current.inside = true;
      pointer.current.touch = e.pointerType === 'touch';
      // While look-dragging (primary button held) hover picking is pointless
      // and would re-render the pick scene every frame — skip it.
      if ((e.buttons & 1) !== 0) return;
      const rect = el.getBoundingClientRect();
      pointer.current.x = e.clientX - rect.left;
      pointer.current.y = e.clientY - rect.top;
      pointer.current.moved = true;
    };
    const onDown = (e: PointerEvent) => {
      pointer.current.touch = e.pointerType === 'touch';
      // A primary down starts a new gesture; any other pointer joining it makes it multi-touch.
      pointer.current.multiTouch = !e.isPrimary;
      pointer.current.downX = e.clientX;
      pointer.current.downY = e.clientY;
      pointer.current.down = true;
      if (e.button === 0) {
        pointer.current.dragging = true;
        updateCursor();
      }
    };
    const onUp = (e: PointerEvent) => {
      const p = pointer.current;
      if (e.button === 0) {
        pointer.current.dragging = false;
        updateCursor();
      }
      // A press that started on a panel and ends here is not a click on a star.
      if (!pointer.current.down) return;
      pointer.current.down = false;
      const dx = e.clientX - pointer.current.downX;
      const dy = e.clientY - pointer.current.downY;
      if (!p.multiTouch && e.button === 0 && Math.hypot(dx, dy) <= CLICK_MAX_DRAG_PX) {
        const rect = el.getBoundingClientRect();
        pointer.current.click = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };
    const onCancel = () => {
      pointer.current.multiTouch = false;
      pointer.current.down = false;
      pointer.current.dragging = false;
      updateCursor();
    };
    // Leaving the canvas (e.g. onto a HUD panel) gives no more pointermove, so
    // the last hover would stick; drop it and any pending pick.
    const onLeave = () => {
      pointer.current.moved = false;
      pointer.current.inside = false;
      pointer.current.down = false;
      latest.invalidate();
      setHoveredStar(null);
      pointer.current.dragging = false;
      pointer.current.over = false;
      updateCursor();
    };
    updateCursor();
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerleave', onLeave);
      // Drop a stale hover that would otherwise reappear on remount.
      latest.invalidate();
      setHoveredStar(null);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, [gl, setHoveredStar, latest]);

  useEffect(() => () => pickTarget.dispose(), [pickTarget]);
  useEffect(() => () => pickScene?.material.dispose(), [pickScene]);

  // Separate buffers: a click must never overwrite an in-flight async hover read.
  const clickPixel = useMemo(() => new Uint8Array(4), []);
  const hoverPixel = useMemo(() => new Uint8Array(4), []);
  const prevClearColor = useMemo(() => new THREE.Color(), []);

  const idToStar = (pixel: Uint8Array): number | null => {
    const id = pixel[0]! | (pixel[1]! << 8) | (pixel[2]! << 16);
    const count = geometry ? geometry.getAttribute('aSize').count : 0;
    return id < count ? id : null;
  };

  /** Renders the pick scene at (x, y), calls `read` while the target is bound, then restores renderer state. */
  const renderPickAt = <T,>(x: number, y: number, read: () => T): T | null => {
    if (!geometry || !pickScene) return null;
    // Same size law as the visible cloud (user-tunable gamma).
    pickScene.material.uniforms.uSizeGamma!.value = useSettingsStore.getState().sizeGamma;
    const dpr = gl.getPixelRatio();
    // Same ratio as the visible cloud, so hit targets match the drawn stars (capped on phones, #25).
    pickScene.material.uniforms.uPixelScale!.value =
      STAR_PIXEL_SCALE * Math.min(globalThis.devicePixelRatio ?? 1, dpr);
    const cam = camera as THREE.PerspectiveCamera;
    // A scene-wide view offset (phone sheet, #25) shifts what is drawn under the pointer: pick
    // in the shifted frame, then restore it instead of clearing it.
    const prevView = cam.view?.enabled ? { ...cam.view } : null;
    cam.setViewOffset(
      size.width * dpr,
      size.height * dpr,
      (x + (prevView?.offsetX ?? 0)) * dpr,
      (y + (prevView?.offsetY ?? 0)) * dpr,
      1,
      1,
    );

    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;
    gl.getClearColor(prevClearColor);
    const prevClearAlpha = gl.getClearAlpha();

    gl.setRenderTarget(pickTarget);
    gl.setClearColor(NO_STAR, 1);
    gl.autoClear = true;
    gl.render(pickScene.scene, cam);
    const result = read();

    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClearColor, prevClearAlpha);
    gl.autoClear = prevAutoClear;
    if (prevView) {
      cam.setViewOffset(
        prevView.fullWidth,
        prevView.fullHeight,
        prevView.offsetX,
        prevView.offsetY,
        prevView.width,
        prevView.height,
      );
    } else cam.clearViewOffset();
    return result;
  };

  const readStarAt = (x: number, y: number, pixel: Uint8Array): number | null => {
    const ok = renderPickAt(x, y, () => {
      gl.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pixel);
      return true;
    });
    return ok ? idToStar(pixel) : null;
  };

  const applyHover = (hovered: number | null) => {
    const p = pointer.current;
    setHoveredStar(hovered);
    p.over = hovered !== null;
    gl.domElement.style.cursor = canvasCursor(p.dragging, p.over);
  };

  const poseChanged = (): boolean =>
    lastPose.set &&
    !(camera.matrixWorld.equals(lastPose.world) && camera.projectionMatrix.equals(lastPose.proj));

  const requestHover = (p: typeof pointer.current, now: number) => {
    // Pose is stored before the pick's temporary view offset alters the projection.
    lastPose.world.copy(camera.matrixWorld);
    lastPose.proj.copy(camera.projectionMatrix);
    lastPose.set = true;
    p.lastPickMs = now;
    p.moved = false;
    if (asyncUnsupported.current) {
      applyHover(readStarAt(p.x, p.y, hoverPixel));
      return;
    }
    let pending: Promise<unknown> | null = null;
    let threw = false;
    try {
      pending = renderPickAt(p.x, p.y, () =>
        gl.readRenderTargetPixelsAsync(pickTarget, 0, 0, 1, 1, hoverPixel),
      );
    } catch {
      threw = true;
    }
    if (!pending) {
      // No pick scene yet (null) is not a lack of support: only a throw switches to the sync read.
      if (threw) {
        asyncUnsupported.current = true;
        p.moved = true;
      }
      return;
    }
    p.inFlight = true;
    const ticket = latest.next();
    pending.then(
      () => {
        p.inFlight = false;
        if (latest.isCurrent(ticket)) applyHover(idToStar(hoverPixel));
      },
      () => {
        // Not an error: some contexts lack async readback; hover falls back to the sync read.
        p.inFlight = false;
        asyncUnsupported.current = true;
        p.moved = true;
      },
    );
  };

  useFrame(() => {
    const p = pointer.current;
    // While an async hover read is pending three leaves a PIXEL_PACK_BUFFER bound, which would
    // swallow a synchronous readPixels (zeros = star 0): the click waits for the few ms of flight.
    if (p.click && !p.inFlight) {
      const picked = readStarAt(p.click.x, p.click.y, clickPixel);
      // A click on empty sky keeps the current selection: only the ✕ closes it.
      if (picked !== null) selectStar(picked);
      // Click-lock also flies to the fixed arrival distance (same as search
      // select, SPEC §6.3 + user decision post-M5): the camera always ends
      // ARRIVE_DISTANCE_LY in front of a locked star.
      const core = getStarCore();
      if (picked !== null && core) {
        const i = picked * 3;
        useGalaxyMapStore
          .getState()
          .requestFlyTo([core.position[i]!, core.position[i + 1]!, core.position[i + 2]!]);
      }
      p.click = null;
    }
    const now = performance.now();
    if (
      shouldPickHover({
        moved: p.moved,
        inside: p.inside,
        touch: p.touch,
        dragging: p.dragging,
        poseChanged: poseChanged(),
        inFlight: p.inFlight,
        nowMs: now,
        lastPickMs: p.lastPickMs,
      })
    ) {
      requestHover(p, now);
    }
  }, -1);

  return null;
}
