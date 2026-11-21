# Rules 013-render-cleanup

## Conventions
- When you annotate a constant that feeds a shader uniform, the unit matches the uniform's comment in the `.vert`/`.frag` — `STAR_PIXEL_SCALE` was marked "unitless" in `app/src/scene/StarCloud.tsx` while `star.vert` documents `uPixelScale` as px·ly; a contradictory unit is worse than none (#48).

## Patterns
- The `?pdb=1` test gate is read only through `exposeBridge` from `app/src/lib/testBridge.ts` — the parsing was copied in four scene files (`SystemScene`, `HostStar`, `StarCloud`, `GalaxyScene`) and could drift (#48).
- Before and after a render change run `npm run build && npm run test:visual` (win32 baselines, desktop) — e2e checks bridges and pixels at points, not the whole picture, so a refactor could change the look unnoticed (#48).
