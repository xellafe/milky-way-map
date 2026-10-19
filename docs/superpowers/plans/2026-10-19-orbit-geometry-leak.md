# Leak GPU delle orbite nella System View (issue #34) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** geometry e material delle orbite vengono rilasciati allo smontaggio o al ricalcolo.

**Spec:** `docs/superpowers/specs/2026-10-19-orbit-geometry-leak-design.md`

**Branch:** `fix/orbit-geometry-leak`

## Task 1: dispose delle orbite e test di regressione

**Files:**
- Modify: `app/src/scene/SystemScene.tsx`
- Test: `app/tests/e2e/system.spec.ts`

**Passi:**
- [ ] Bridge `__system.geometries` (`gl.info.memory.geometries`).
- [ ] Test red: TRAPPIST-1, baseline, N cicli `simple` ↔ `trail`, ritorno
      allo stile iniziale → stesso conteggio.
- [ ] Fix: effect di cleanup con `dispose()` in `SimpleOrbit` e `TrailOrbit`.
- [ ] Gate completo verde.
- [ ] Commit `fix(render): dispose orbit geometries and materials`.
