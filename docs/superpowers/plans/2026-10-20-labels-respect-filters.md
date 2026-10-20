# Etichette delle stelle nascoste dai filtri (issue #35) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** le etichette dei nomi rispettano la maschera dei filtri.

**Spec:** `docs/superpowers/specs/2026-10-20-labels-respect-filters-design.md`

**Branch:** `fix/labels-respect-filters`

## Task 1: maschera `aVisible` in `StarLabels` e test di regressione

**Files:**
- Modify: `app/src/scene/StarLabels.tsx`
- Test: `app/tests/e2e/view.spec.ts` (o `filters.spec.ts`)

**Passi:**
- [ ] Test red: nomi attivi, etichetta di Polaris visibile → filtro che la
      nasconde → etichetta assente → filtro tolto → etichetta di nuovo
      visibile.
- [ ] Fix: scartare i candidati con `aVisible === 0`.
- [ ] Gate completo verde.
- [ ] Commit `fix(render): hide labels of stars filtered out`.
