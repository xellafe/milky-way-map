# SKILL: three-points-shader

Renderizza la nuvola di ~milioni di stelle come **un singolo `THREE.Points`**
con shader GLSL custom, picking GPU e maschera filtri (SPEC §4.2, §6, §7).

## Quando usarla
Milestone **M2** (rendering), **M3** (picking), **M4** (maschera filtri). Subagent `rendering`.

## Principi
- **Un solo draw call**: `BufferGeometry` + `ShaderMaterial`. **Mai** una mesh per stella.
- Attributi in **SoA**: `position` (ly), `color` (vec3), `size`, `spectralClass`, `flags`.
- `vertex.glsl`: calcola `gl_PointSize` da dimensione (mag. assoluta) con **attenuazione prospettica** (`size / -mvPosition.z`), clamp min/max.
- `fragment.glsl`: punto morbido (smoothstep su distanza dal centro), additive blending; il glow forte arriva dal **bloom** in post-processing (non sovraccaricare il fragment).
- Sfondo **nero pieno**, nessuna skybox.

## Picking GPU (M3)
- Render pass separato su render target: colore = ID stella codificato (RGBA → uint).
- Leggi il pixel sotto il cursore per hover/selezione. Niente raycast CPU su milioni di punti.

## Maschera filtri (M4)
- Attributo per-vertice `visible` (float 0/1) o bit in `flags`; aggiornato da CPU quando i filtri cambiano, letto nel vertex shader per scartare (es. `gl_PointSize = 0.0` o `gl_Position` fuori clip).
- I filtri **non** ricaricano i dati: solo update di attributo + `needsUpdate`.

## Performance (target SPEC §7)
- 60 FPS con la nuvola completa: SoA, frustum/distance LOD, lazy-load dell'index nomi.
- Caricamento progressivo: mostra la nuvola appena disponibile, non bloccare sul download totale.
- Baseline WebGL2; messaggio di fallback se assente.

## Gotcha
- Coordinate **eliocentriche** in **ly** (assi HYG): documenta l'orientamento degli assi.
- Attenzione al precision dei Float32 su scene molto estese (camera-relative rendering se serve).
- Usa R3F/drei in modo dichiarativo ma tieni lo shader e i buffer sotto controllo manuale.

## Done
Nuvola renderizzata su fixture e dati completi, FPS misurato vs budget, smoke test Playwright (M2/M3/M4 AC).
