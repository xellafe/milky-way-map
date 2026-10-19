# Leak GPU delle orbite nella System View (issue #34) — design

## Problema

`SimpleOrbit` e `TrailOrbit` (`app/src/scene/SystemScene.tsx`) creano
`BufferGeometry` e material in `useMemo` e li montano con `<primitive>`. R3F
non rilascia gli oggetti passati come primitive, quindi geometry e material
restano allocati sulla GPU. Il leak si ripete a ogni cambio di
`orbitStyle`, a ogni toggle del filtro per tipo di pianeta (il gruppo si
rimonta) e a ogni cambio di `maxA`. `ThickOrbit` usa `Line` di drei, che
rilascia da sé le proprie risorse.

## Soluzione

In entrambi i componenti, un effect di cleanup legato all'oggetto `line`:
`geometry.dispose()` e `material.dispose()`, come già fanno
`HabitableZoneRing` e `HostStar`.

Per la verifica, il bridge di test `__system` (solo con `?pdb=1`) espone
`geometries: gl.info.memory.geometries`.

## Acceptance

1. In System View (TRAPPIST-1), passando N volte (≥ 5) tra gli stili `simple`
   e `trail` e tornando allo stile di partenza, `__system.geometries` torna
   al valore iniziale.
2. Il test e2e di regressione fallisce prima del fix.
3. I test esistenti di `system.spec.ts` restano verdi.
