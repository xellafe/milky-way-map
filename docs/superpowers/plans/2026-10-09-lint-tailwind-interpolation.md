# Lint delle classi Tailwind attaccate a `${…}` (issue #27) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** `npm run lint` fallisce sulle classi attaccate a `${…}` nei `className`.

**Spec:** `docs/superpowers/specs/2026-10-09-lint-tailwind-interpolation-design.md`

**Branch:** `chore/lint-tailwind-interpolation`

## Task 1: regola `no-restricted-syntax` e test

**Files:**
- Modify: `app/eslint.config.js`
- Test: `app/tests/unit/tailwindLint.test.ts`

**Passi:**
- [ ] Test red: con `ESLint` (API Node) e la config reale, `lintText` su file
      `.tsx` fittizi; attesi errori per `p-2${c}`, `${c}p-2`, `a ${b}c`;
      nessun errore per `p-2 ${c}`, `${c} p-2`, ternaria annidata, template
      multilinea, `data-x={`a${b}c`}`.
- [ ] Regola nella config (selettori nella spec), commento con il perché.
- [ ] Gate veloce verde; `npm run lint` verde sul codice attuale.
- [ ] Commit `chore: lint tailwind classes glued to interpolations`.
