# Rules digest

Date: 2026-11-21 15:34
Features: 001-loader-retry-errors, 002-search-catalog-ids, 003-star-fetch-hardening, 004-settings-rehydration, 005-range-filters, 006-searchbox-blur-a11y, 007-timebar-resume-state, 008-mobile-sheet-keyboard-close, 009-hudbutton-size-prop, 010-star-picking-hover-dpr, 011-camera-loop-allocations, 012-i18n-units-cleanup, 013-render-cleanup

No previous digest: all features and the whole `main` history analysed. Rules approved in
`factory/rules/012-*.md` and `013-*.md` are not yet in the playbook and were not analysed.

| # | section | rule | evidence | outcome |
|---|---------|------|----------|---------|
| 1 | Conventions | Source of truth: `docs/SPEC.md` (what) and `AGENTS.md` (how); read both before… | none | no evidence |
| 2 | Conventions | English for code, identifiers, comments, commits; Italian for specs, `docs/STATE.md`… | none | no evidence |
| 3 | Conventions | Branches `feat\|fix\|docs\|chore/<slug>` from `main`; commits `type(scope): subject`… | all Factory commits conform | keep |
| 4 | Conventions | Comments explain the why and cite `SPEC §x` or `#<issue>`; tuning constants state… | 013 r1 blocking (unit), fix 59baa99; no bare TODO | keep |
| 5 | Conventions | PR title is `type(scope): subject` and drives the release bump… | none | no evidence |
| 6 | Conventions | User-visible strings only in `app/src/i18n/locales/{en,it,es,fr,de}.json`… | i18n.test.ts present, 003/012 touched all locales | keep |
| 7 | Patterns | Logic in `app/src/lib/`, `app/src/state/` or `app/src/data/` with Vitest unit tests… | unit + e2e in every fix commit | keep |
| 8 | Patterns | E2E data comes from the golden fixtures via `serveFixtureData`… | fixtures.ts used by e2e specs | keep |
| 9 | Patterns | Lazily fetched data exposes a `LoadStatus`… | 001/003 loaderErrors.spec.ts | keep |
| 10 | Patterns | Persisted settings: zustand `persist` in `app/src/state/settings.ts` (`version` field)… | overlaps next rule | merged |
| 11 | Patterns | Persisted state is untrusted input: every `persist` store has a `merge`… | 004 [dup], settings.ts:109-111 | merged |
| 12 | Patterns | Bounds of a numeric setting live in one exported constant (`SETTING_RANGES`… | 004 [dup], used by OptionsPanel | keep |
| 13 | Patterns | Layout changes are checked with bounding boxes in e2e tests, not only DOM presence… | duplicate of DoD [ui] bounding boxes | merged |
| 14 | Patterns | Loaders take an optional `AbortSignal`; an `AbortError` is never surfaced… | 003 [dup], App.tsx/starData.ts | keep |
| 15 | Patterns | Data-integrity failures (e.g. a bad manifest) use a typed error… | StarManifestError, errors.dataCorrupt present | keep |
| 16 | Patterns | Module-level caches tied to a URL base either include the base in the key… | none | no evidence |
| 17 | Patterns | Combobox popups (search, menus) close on blur; pointer choices use `onMouseDown`… | 006 [dup], SearchBox.tsx:316 | keep |
| 18 | Patterns | axe scans of a widget with a popup run with the popup open, not only closed (#41). | 006/008 axe with popup open | keep |
| 19 | Patterns | e2e tests for phone-layout behaviour in a `chromium`-project spec use `hasTouch… | search/timeBarState specs | keep |
| 20 | Patterns | A numeric text field applies on blur/Enter (Escape reverts, bad input reverts… | 005, RangeSlider.tsx | keep |
| 21 | Patterns | Per-event O(N) work driven by a continuous control (slider drag) is coalesced… | 005, frameCoalescer.ts | keep |
| 22 | Patterns | Playwright runs against `npm run preview` (the `dist` build), so run `npm run build`… | proposed twice (005, 006); 013 rebuilt baselines | keep |
| 23 | Patterns | An element with `aria-expanded` that mounts its popup/content conditionally sets… | violated: SearchBox.tsx:225, MusicPlayer.tsx:278 | check queued 014-aria-controls-target-check |
| 24 | Patterns | A local Escape action inside the dock calls `e.preventDefault()`… | none | no evidence |
| 25 | Patterns | When a spec claims a bug fix is covered by an e2e regression test, the implementer… | 007 r1 blocking, 008 non-blocking; 009-011 respected | keep |
| 26 | Patterns | To assert in e2e that a text is "gone or different", poll `textContent`… | 010 hoverRepick.spec.ts | keep |
| 27 | Patterns | Per-frame three.js math uses module-level scratch objects or caller-provided `out`… | 011 commits 0aa08ab, b7a552b | moved to `.claude/rules/scene-frame-loop.md` |
| 28 | Patterns | Per-frame consumers of the usable area read it through `useCachedUsableArea`… | 011; readUsableArea only in usableArea.ts | moved to `.claude/rules/scene-frame-loop.md` |
| 29 | Patterns | A module holder written on unmount (e.g. `cameraPoseStore`) also seeds the component… | 011 b7a552b, cameraPoseStore.test.ts | keep |
| 30 | Patterns | A test assertion must be able to fail: never check a value against a quantity… | 011 r1 CHANGES, rework 223293a | keep |
| 31 | Reusable code | Data base path: `DATA_BASE_URL` from `app/src/data/starData.ts`. | 003 security review: URLs from DATA_BASE_URL | keep |
| 32 | Reusable code | Large star arrays: module holders `app/src/data/starCoreStore.ts`, `labelStore.ts`… | paths exist, storeHygiene test | keep |
| 33 | Reusable code | Number formatting with missing values: `formatNumber` in `app/src/lib/format.ts`… | used in ControlDock.tsx | keep |
| 34 | Reusable code | HUD primitives in `app/src/ui/hud/` (`HudButton`, `HudCard`, `DataRow`, `Tabs`, …)… | 009 extended HudButton | keep |
| 35 | Reusable code | Loader retry helpers for tests: `app/tests/unit/loaderRetry.ts`. | none | no evidence |
| 36 | Don'ts | No large typed arrays in React state/props (guarded by `app/tests/unit/storeHygiene… | guard test present | keep |
| 37 | Don'ts | No per-star meshes: the cloud is a single `Points` with shader (SPEC §4.2). | none | no evidence |
| 38 | Don'ts | Never fabricate astronomical values: missing = `n/d` / `null`. | duplicate of DoD [code] n/d | merged |
| 39 | Don'ts | Do not change the core stack, pinned versions, `docs/SPEC.md` or `AGENTS.md`… | none | no evidence |
| 40 | Don'ts | No committed `.only`/`.skip`, no retries added to hide flaky tests (log them in… | grep clean; 013 flaky logged | keep |
| 41 | Don'ts | Tailwind: custom CSS in `index.css` stays in `@layer components`; separate a class… | 009 [dup] (size as prop) | keep |
| 42 | Don'ts | Never issue a synchronous `readRenderTargetPixels` while a three `readRenderTarget… | 010 [dup] + review | keep |
| 43 | Don'ts | In the Bash tool, no heredocs whose body has non-ASCII characters (e.g. `×`, `≠`)… | none | no evidence |
| 44 | Definition of Done | [gate] Build, lint and tests are green. | gate files of every feature | keep |
| 45 | Definition of Done | [code] Every acceptance criterion has an automated test or a precise manual step. | 011 DoD-2 fail caught; 010/012 escalations | keep |
| 46 | Definition of Done | [security] No secrets in code or committed configuration. | secrets scan in board log | keep |
| 47 | Definition of Done | [code] Every bug fix has a regression test that fails before the fix. | DoD-4 cited 004, 007-011 | keep |
| 48 | Definition of Done | [code] User-visible strings are in all five locale files. | 003, 012 | keep |
| 49 | Definition of Done | [code] `docs/STATE.md` has a section for the issue (bullets ≤ 3 lines)… | STATE.md in fix commits | keep |
| 50 | Definition of Done | [ux] UI changes have no serious/critical `axe` violations. | ux reviews 003, 006, 008 | keep |
| 51 | Definition of Done | [code] Missing astronomical data renders as `n/d`, never as a guessed value. | none | no evidence |
| 52 | Definition of Done | [ui] Layout changes are verified with bounding boxes at desktop and mobile widths. | ui reviews; 012 escalation 375px | keep |
