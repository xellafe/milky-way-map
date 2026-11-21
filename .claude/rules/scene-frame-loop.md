---
paths:
  - "app/src/scene/**"
---

# Scene frame loop

- Per-frame three.js math uses module-level scratch objects or caller-provided `out` buffers, never `new`/`clone()`/`toArray()` without a target — avoids GC pauses during camera motion (`app/src/scene/cameraTween.ts`, `PlanetFollow`, #46).
- Per-frame consumers of the usable area read it through `useCachedUsableArea`, never `readUsableArea` directly — avoids a forced layout every frame (`app/src/scene/placeAnchor.ts`, #46).
