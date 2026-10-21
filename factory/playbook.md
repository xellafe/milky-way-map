# Project playbook

## Conventions
- Source of truth: `docs/SPEC.md` (what) and `AGENTS.md` (how); read both before working.
- English for code, identifiers, comments, commits; Italian for specs, `docs/STATE.md`, `NOTICE.md`.
- Branches `feat|fix|docs|chore/<slug>` from `main`; commits `type(scope): subject`, scopes listed in `AGENTS.md`, trailer `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Comments explain the why and cite `SPEC §x` or `#<issue>`; tuning constants state unit and nature (data / aesthetic choice / human choice); `TODO(#n)` only.
- User-visible strings only in `app/src/i18n/locales/{en,it,es,fr,de}.json` (key parity enforced by `app/tests/unit/i18n.test.ts`).

## Patterns
- Logic in `app/src/lib/`, `app/src/state/` or `app/src/data/` with Vitest unit tests in `app/tests/unit/` (no DOM); components are covered by Playwright in `app/tests/e2e/`.
- E2E data comes from the golden fixtures via `serveFixtureData` in `app/tests/e2e/fixtures.ts` (Range-aware); never invent test data (SPEC §5.4).
- Lazily fetched data exposes a `LoadStatus` (`app/src/data/loadStatus.ts`) and surfaces errors per SPEC §10 (see `app/tests/e2e/loaderErrors.spec.ts`).
- Persisted settings: zustand `persist` in `app/src/state/settings.ts` (`version` field); a shape change bumps the version.
- Layout changes are checked with bounding boxes in e2e tests, not only DOM presence; `data-testid`s are a contract.

## Reusable code
- Data base path: `DATA_BASE_URL` from `app/src/data/starData.ts`.
- Large star arrays: module holders `starCoreStore`, `labelStore`, `starDetailsStore` in `app/src/data/`.
- Number formatting with missing values: `formatNumber` in `app/src/lib/format.ts` (returns `null` → show `n/d`).
- HUD primitives in `app/src/ui/hud/` (`HudButton`, `HudCard`, `DataRow`, `Tabs`, …): reuse before writing new controls.
- Loader retry helpers for tests: `app/tests/unit/loaderRetry.ts`.

## Don'ts
- No large typed arrays in React state/props (guarded by `app/tests/unit/storeHygiene.test.ts`).
- No per-star meshes: the cloud is a single `Points` with shader (SPEC §4.2).
- Never fabricate astronomical values: missing = `n/d` / `null`.
- Do not change the core stack, pinned versions, `docs/SPEC.md` or `AGENTS.md` without human approval.
- No committed `.only`/`.skip`, no retries added to hide flaky tests (log them in `docs/STATE.md`).
- Tailwind: custom CSS in `index.css` stays in `@layer components`; separate a class from `${…}` with a space (lint rule in `app/eslint.config.js`); size that must vary is a prop, not a `className` override.

## Definition of Done
- [gate] Build, lint and tests are green.
- [code] Every acceptance criterion has an automated test or a precise manual step.
- [security] No secrets in code or committed configuration.
- [code] Every bug fix has a regression test that fails before the fix.
- [code] User-visible strings are in all five locale files.
- [code] `docs/STATE.md` has a section for the issue (bullets ≤ 3 lines); `README.md`/`NOTICE.md` updated when the `AGENTS.md` doc map requires it.
- [ux] UI changes have no serious/critical `axe` violations.
- [code] Missing astronomical data renders as `n/d`, never as a guessed value.
- [ui] Layout changes are verified with bounding boxes at desktop and mobile widths.
