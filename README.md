# Galaxy Map

A desktop web app that renders the local stellar neighborhood in 3D — heliocentric
coordinates, real catalog data (HYG / AT-HYG) — and lets you fly into exoplanet
systems to watch their orbits animate to scale (NASA Exoplanet Archive).

> Status: feature-complete (milestones M0–M9 implemented), pending the
> `[FINAL HUMAN CHECK]` before any public release. See `docs/SPEC.md` (what),
> `AGENTS.md` (how), `docs/STATE.md` (current progress).

## Features

- 3D point cloud of ~2.49M stars (AT-HYG + HYG) in a single draw call, with
  energy-faithful sizing/color and bloom.
- Free-fly + click-to-orbit camera with animated fly-to; `prefers-reduced-motion`
  aware.
- GPU picking, hover labels, star detail panel, always-on names with culling,
  IAU constellation lines (toggle).
- Search (proper names, HD/HIP/Gl, Gaia/TYC ids, exoplanet hosts) and runtime
  filters via a GPU visibility mask.
- System View: fly into an exoplanet system, real-scale orbits (Kepler solver),
  shared time-scale slider, habitable-zone overlay (approximate √L model),
  planet type filter and selectable orbit style (trail / thick / simple).
  Planet sizes and looks are **presentational, not data**: the catalog has no
  planet colors or surfaces, so each planet gets a procedural look from its
  size class (rocky / sub-Neptune / giant / unknown, from radius or mass) plus
  a per-planet variation derived from its name.
- i18n (EN/IT/ES/FR/DE) and a keyboard-accessible 2D overlay (axe-clean).

## Structure

| Path             | Contents                                                          |
| ---------------- | ----------------------------------------------------------------- |
| `app/`           | Frontend — Vite + React + TypeScript + react-three-fiber/Three.js |
| `data-pipeline/` | Offline Python ETL (catalogs → binary star data + exoplanets)     |
| `data/`          | Generated data artifacts (gitignored; CC BY-SA 4.0)               |
| `docs/`          | SPEC.md (requirements), STATE.md (development state)              |
| `.github/`       | CI (lint/typecheck/test/build/e2e + pytest) and the data-refresh cron |
| `NOTICE.md`      | Attributions (HYG/AT-HYG CC BY-SA, NASA archive, Stellarium)      |
| `LICENSE`        | MIT (code)                                                        |

## Development

Frontend (Node 22+):

```sh
cd app
npm ci
npm run dev        # dev server
npm run build      # type-check + production build
npm run lint       # ESLint
npm run typecheck  # tsc -b
npm test           # Vitest unit tests
npm run test:e2e   # Playwright (requires: npx playwright install chromium; runs against `npm run preview`, so build first)
```

Data pipeline (Python 3.12+): see `data-pipeline/README.md`.

## Performance budgets (defined in M0, verified in M9 — SPEC §7)

Budgets and the latest measured results (1920×1080, headless Chromium, ANGLE
D3D11, NVIDIA RTX 3080):

| Budget | Target | Measured (M9) |
| ------ | ------ | ------------- |
| FPS, full AT-HYG cloud (2.49M stars, single draw call) | 60 FPS | 60.1 / 60.0 (vsync-capped; run 1 = 46.9 warmup) |
| JS bundle, gzip (star data streamed separately) | ≤ 600 KB | ~354 KB (app 94 + three vendor 260) |
| CSS, gzip | ≤ 50 KB | 4.1 KB |

WebGL2 baseline with a friendly fallback message. Re-measure with
`node scripts/measure-fps.mjs` (preview server running) and
`node scripts/measure-memory.mjs`.

## Data refresh & deployment

The Python pipeline (`data-pipeline/`) produces the served artifacts under
`data/` (gitignored; ~155 MB served; CC BY-SA 4.0 derivatives). In dev/preview
they are served at `<base>/data/*` with HTTP Range support by a Vite plugin
(`vite.config.ts`).

**Live site:** https://xellafe.github.io/milky-way-map/ (GitHub Pages).

`.github/workflows/data-refresh.yml` re-runs the pipeline weekly (and on manual
dispatch), regenerates the artifacts, and validates them
(`data-pipeline/validate_artifacts.py`). A failed source fetch makes the run RED
rather than silently stale (SPEC §10). The scheduled run — or a manual run with
`dry_run=false` — then **deploys to GitHub Pages**: the app is built with
`VITE_BASE=/<repo>/` (all data URLs derive from it) and the validated data
artifact is shipped under `<base>/data/`, with `NOTICE.md`/`LICENSE` for
attribution. The data never enters git. To publish app code changes, dispatch
the workflow manually with `dry_run=false`:

```bash
gh workflow run data-refresh.yml -f dry_run=false
```

To preview the Pages build locally: `VITE_BASE=/milky-way-map/ npm run build`
then `VITE_BASE=/milky-way-map/ npm run preview` (Git Bash: prefix
`MSYS_NO_PATHCONV=1`).

## Licensing

- **Code:** MIT (see `LICENSE`).
- **Astronomical data:** HYG/AT-HYG by astronexus (David Nash) under **CC BY-SA 4.0**;
  generated data artifacts are derivative works and stay CC BY-SA 4.0.
- NASA Exoplanet Archive acknowledgment and all attributions: see `NOTICE.md`.
