/* eslint-disable react-hooks/immutability --
   GPU picking is inherently imperative three.js: it must save/mutate/restore
   renderer state (render target, clear color, autoClear, cursor) around the
   off-screen ID render. The mutations are frame-scoped and fully restored. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import starPickFrag from '../shaders/star-pick.frag?raw';
import starPickVert from '../shaders/star-pick.vert?raw';
import { useGalaxyMapStore } from '../state/store';
import { STAR_MAX_PX, STAR_PIXEL_SCALE } from './StarCloud';

const PICK_MIN_PX = 7.0; // hover comfort: tiny stars get a larger hit target
const CLICK_MAX_DRAG_PX = 5; // pointerdown→up movement below this = click, not a look-drag
const NO_STAR = 0xffffff; // clear color: ids >= count mean "nothing"

/**
 * GPU picking (skill three-points-shader): a second Points sharing the SAME
 * BufferGeometry renders star indices as 24-bit colors into a 1×1 render
 * target via camera.setViewOffset, reading back the pixel under the cursor.
 * Runs at most once per frame, only when the pointer moved or clicked.
 * Depth testing is enabled so the nearest star wins in dense regions.
 */
export function StarPicking({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { gl, camera, size } = useThree();
  const setHoveredStar = useGalaxyMapStore((s) => s.setHoveredStar);
  const selectStar = useGalaxyMapStore((s) => s.selectStar);

  const pointer = useRef({
    x: 0,
    y: 0,
    moved: false,
    downX: 0,
    downY: 0,
    click: null as { x: number; y: number } | null,
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
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: starPickVert,
      fragmentShader: starPickFrag,
      uniforms: {
        uPixelScale: {
          value: STAR_PIXEL_SCALE * Math.min(globalThis.devicePixelRatio ?? 1, 2),
        },
        uMaxPx: { value: STAR_MAX_PX },
        uPickMinPx: { value: PICK_MIN_PX },
      },
      depthTest: true,
      depthWrite: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(points);
    return { scene, material };
  }, [geometry]);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.current.x = e.clientX - rect.left;
      pointer.current.y = e.clientY - rect.top;
      pointer.current.moved = true;
    };
    const onDown = (e: PointerEvent) => {
      pointer.current.downX = e.clientX;
      pointer.current.downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      const dx = e.clientX - pointer.current.downX;
      const dy = e.clientY - pointer.current.downY;
      if (e.button === 0 && Math.hypot(dx, dy) <= CLICK_MAX_DRAG_PX) {
        const rect = el.getBoundingClientRect();
        pointer.current.click = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, [gl]);

  useEffect(() => () => pickTarget.dispose(), [pickTarget]);
  useEffect(() => () => pickScene.material.dispose(), [pickScene]);

  const pixel = useMemo(() => new Uint8Array(4), []);
  const prevClearColor = useMemo(() => new THREE.Color(), []);

  const readStarAt = (x: number, y: number): number | null => {
    const dpr = gl.getPixelRatio();
    const cam = camera as THREE.PerspectiveCamera;
    cam.setViewOffset(size.width * dpr, size.height * dpr, x * dpr, y * dpr, 1, 1);

    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;
    gl.getClearColor(prevClearColor);
    const prevClearAlpha = gl.getClearAlpha();

    gl.setRenderTarget(pickTarget);
    gl.setClearColor(NO_STAR, 1);
    gl.autoClear = true;
    gl.render(pickScene.scene, cam);
    gl.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pixel);

    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClearColor, prevClearAlpha);
    gl.autoClear = prevAutoClear;
    cam.clearViewOffset();

    const id = pixel[0]! | (pixel[1]! << 8) | (pixel[2]! << 16);
    const count = geometry.getAttribute('aSize').count;
    return id < count ? id : null;
  };

  useFrame(() => {
    const p = pointer.current;
    if (!p.moved && !p.click) return;
    if (p.click) {
      selectStar(readStarAt(p.click.x, p.click.y));
      p.click = null;
    }
    if (p.moved) {
      const hovered = readStarAt(p.x, p.y);
      setHoveredStar(hovered);
      gl.domElement.style.cursor = hovered === null ? '' : 'pointer';
      p.moved = false;
    }
  }, -1);

  return null;
}
