# Cursore grab/grabbing (issue #11) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** cursore `grab`/`grabbing` sul canvas 3D in Galaxy e System View.

**Spec:** `docs/superpowers/specs/2026-10-02-grab-cursor-design.md`

**Branch:** `feat/grab-cursor`

## Task 1: cursore grab/grabbing nelle due viste

**Files:**
- Create: `app/src/lib/canvasCursor.ts`
- Modify: `app/src/scene/StarPicking.tsx`, `app/src/scene/SystemScene.tsx`
- Test: `app/tests/unit/canvasCursor.test.ts`, `app/tests/e2e/cursor.spec.ts`

**Interfaccia:**

```ts
export type CanvasCursor = 'grab' | 'grabbing' | 'pointer';
export function canvasCursor(dragging: boolean, overTarget: boolean): CanvasCursor;
```

**Passi:**
- [ ] Test red: unit `canvasCursor` + e2e (Galaxy e System View: `grab` a
      riposo, `grabbing` con `mouse.down()`, `grab` dopo `mouse.up()`).
- [ ] `canvasCursor` in `lib/`.
- [ ] `StarPicking`: cursore da `canvasCursor` al mount, su down/up del tasto
      sinistro, sull'hover e su `pointerleave`.
- [ ] `SystemScene`: componente `GrabCursor` (figlio del Canvas) che scrive
      su `gl.domElement` a ogni frame `canvasCursor(dragging, overPlanet)`;
      `dragging` da pointerdown/up sinistro e `pointercancel` sul document
      (three-stdlib non ha `cursorStyle`); `overPlanet` ref da
      onPointerOver/onPointerOut dei pianeti. E2e extra: rilascio fuori dal
      canvas.
- [ ] Gate completo verde.

**Acceptance:** AC1–AC4 della spec.
