# Cursore grab/grabbing per il drag della camera (issue #11) — design

## Obiettivo

Sul canvas 3D il cursore mostra una mano aperta (`grab`) e una mano chiusa
(`grabbing`) durante il drag che ruota la camera, in entrambe le viste.

## Stato attuale

- **Galaxy View**: il drag è in `app/src/scene/CameraControls.tsx` (solo
  tasto sinistro). Il cursore lo scrive solo `app/src/scene/StarPicking.tsx`:
  `pointer` sopra una stella, `''` altrimenti e su `pointerleave`.
- **System View**: `OrbitControls` di drei (three 0.184). drei incapsula
  `three-stdlib`, il cui `OrbitControls` non ha `cursorStyle` (ce l'ha solo
  `three/examples/jsm`). L'hover sui pianeti (`SystemScene.tsx`) scrive su
  `document.body.style.cursor`: è coperto dallo stile inline del canvas e resta
  `pointer` sul body se la vista si smonta con il mouse sopra un pianeta.

## Design

1. **Regola pura** `canvasCursor(dragging: boolean, overTarget: boolean)` in
   `app/src/lib/canvasCursor.ts`. Priorità: `grabbing` se `dragging`, poi
   `pointer` se `overTarget`, altrimenti `grab`.
2. **Galaxy View**: `StarPicking` resta l'unico scrittore del cursore del
   canvas. Lo imposta con `canvasCursor` al mount (`grab`), su pointerdown
   e pointerup del tasto sinistro, su ogni aggiornamento dell'hover e su
   `pointerleave`. Durante il drag sopra una stella il cursore è `grabbing`.
3. **System View**: un componente `GrabCursor`, figlio del Canvas, scrive
   il cursore su `gl.domElement` a ogni frame con
   `canvasCursor(dragging, overPlanet)`. `dragging` diventa true al pointerdown
   sinistro sul canvas e false al pointerup sinistro / a ogni `pointercancel`
   sul document (three-stdlib non cattura il pointer). `overPlanet` è un ref
   aggiornato da onPointerOver/onPointerOut dei pianeti, che non scrivono
   più su `document.body`: si risolve anche il `pointer` residuo sul body.

Nessuna dipendenza nuova, nessuna stringa UI nuova, SPEC invariata.

## Test

- Unit `canvasCursor`: le tre uscite e la priorità di `grabbing` su `pointer`.
- E2e, in entrambe le viste: cursore calcolato del canvas `grab` a riposo,
  `grabbing` con il tasto sinistro premuto, `grab` dopo il rilascio.
- E2e di regressione "rilascio fuori dal canvas": il cursore torna `grab`.

## Acceptance

- AC1: a riposo il canvas mostra `grab` in Galaxy e System View.
- AC2: con il tasto sinistro premuto il canvas mostra `grabbing`; al rilascio
  torna `grab`.
- AC3: sopra una stella o un pianeta, senza tasti premuti, il cursore è
  `pointer`; durante il drag resta `grabbing`.
- AC4: gate completo verde.
