# Galaxy Map

A desktop web app that renders the local stellar neighborhood in 3D — heliocentric
coordinates, real catalog data (HYG / AT-HYG) — and lets you fly into exoplanet
systems to watch their orbits animate to scale (NASA Exoplanet Archive).

> Status: in development. See `docs/SPEC.md` (what), `AGENTS.md` (how),
> `docs/STATE.md` (current progress).

## Structure

| Path             | Contents                                                          |
| ---------------- | ----------------------------------------------------------------- |
| `app/`           | Frontend — Vite + React + TypeScript + react-three-fiber/Three.js |
| `data-pipeline/` | Offline Python ETL (catalogs → binary star data + exoplanets)     |
| `data/`          | Generated data artifacts (gitignored; CC BY-SA 4.0)               |
| `docs/`          | SPEC.md (requirements), STATE.md (development state)              |

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

- 60 FPS on a mid/high-end desktop with the full AT-HYG cloud (single draw call).
- Initial JS bundle ≤ **600 KB gzip** (app + three/R3F; star data excluded — streamed separately).
- CSS ≤ 50 KB gzip. WebGL2 baseline with a friendly fallback message.

## Licensing

- **Code:** MIT (see `LICENSE`).
- **Astronomical data:** HYG/AT-HYG by astronexus (David Nash) under **CC BY-SA 4.0**;
  generated data artifacts are derivative works and stay CC BY-SA 4.0.
- NASA Exoplanet Archive acknowledgment and all attributions: see `NOTICE.md`.
