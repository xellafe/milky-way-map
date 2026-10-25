# Project playbook

## Conventions
- Source of truth: `docs/SPEC.md` (what) and `AGENTS.md` (how); read both before working.
- English for code, identifiers, comments, commits; Italian for specs, `docs/STATE.md`, `NOTICE.md`.
- Branches `feat|fix|docs|chore/<slug>` from `main`; commits `type(scope): subject`, scopes listed in `AGENTS.md`, trailer `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Comments explain the why and cite `SPEC §x` or `#<issue>`; tuning constants state unit and nature (data / aesthetic choice / human choice); `TODO(#n)` only.
- PR title is `type(scope): subject` and drives the release bump (`release: auto`): `feat` only for user-visible features; `!` / `BREAKING CHANGE` only with human approval.
- User-visible strings only in `app/src/i18n/locales/{en,it,es,fr,de}.json` (key parity enforced by `app/tests/unit/i18n.test.ts`).

## Patterns
- Logic in `app/src/lib/`, `app/src/state/` or `app/src/data/` with Vitest unit tests in `app/tests/unit/` (no DOM); components are covered by Playwright in `app/tests/e2e/`.
- E2E data comes from the golden fixtures via `serveFixtureData` in `app/tests/e2e/fixtures.ts` (Range-aware); never invent test data (SPEC §5.4).
- Lazily fetched data exposes a `LoadStatus` (`app/src/data/loadStatus.ts`) and surfaces errors per SPEC §10 (see `app/tests/e2e/loaderErrors.spec.ts`).
- Persisted settings: zustand `persist` in `app/src/state/settings.ts` (`version` field); a shape change bumps the version.
- Persisted state is untrusted input: every `persist` store has a `merge` that validates each key (type + range, default fallback) and a `migrate` that reuses it (#39).
- Bounds of a numeric setting live in one exported constant (`SETTING_RANGES` in `app/src/state/settings.ts`), read by both the UI and the validator.
- Layout changes are checked with bounding boxes in e2e tests, not only DOM presence; `data-testid`s are a contract.
- Loaders take an optional `AbortSignal`; an `AbortError` is never surfaced as a load error or logged as a failure (see `app/src/data/starData.ts`, `app/src/App.tsx`).
- Data-integrity failures (e.g. a bad manifest) use a typed error and a message distinct from network errors, with no reload hint (see `StarManifestError`, `errors.dataCorrupt`).
- Module-level caches tied to a URL base either include the base in the key or state the single-base assumption in a comment.
- A numeric text field applies on blur/Enter (Escape reverts, bad input reverts, unchanged text is a no-op), never per keystroke — avoids transient values reaching the store (#40).
- Per-event O(N) work driven by a continuous control (slider drag) is coalesced to one run per animation frame via a helper in `app/src/lib/` with an injectable scheduler (#40).
- Playwright runs against `npm run preview` (the `dist` build), so run `npm run build` before `npx playwright test <file>`, otherwise stale code is tested.
- A local Escape action inside the dock calls `e.preventDefault()`, otherwise the document listener in `Dock.tsx` closes the panel (#40).

## Reusable code
- Data base path: `DATA_BASE_URL` from `app/src/data/starData.ts`.
- Large star arrays: module holders `app/src/data/starCoreStore.ts`, `labelStore.ts`, `starDetailsStore.ts` (`get*`/`set*` functions).
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
- In the Bash tool, no heredocs whose body has non-ASCII characters (e.g. `×`, `≠`): the tool fails with "unexpected EOF"; use Write/Edit instead.

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
