# data-pipeline

Offline Python ETL for Galaxy Map (SPEC §4.1, §5).

Modules:

- `fetch_athyg.py` — download AT-HYG v3.3 + HYG v4.2 (pinned Codeberg URLs, LFS `/media/` endpoint) → `../data/raw/` + `sources.json` (sha256, timestamps).
- `fetch_exoplanets.py` — NASA Exoplanet Archive `pscomppars` via TAP sync (DOI 10.26133/NEA13) → `../data/raw/exoplanets_raw.json`.
- `build_star_binary.py` — clean + transform → `../data/stars.bin`, `stars.manifest.json`, `names.index.json` (SoA little-endian, SPEC §5.1). Logs excluded-star counts. Per the human-approved CHECKPOINT 1 split, `names.index.json` is the **classic** index (proper/HD/HIP/Gl + constellation, ~16 MB) while Gaia/TYC ids live in `catalog-ids.bin` (fixed 16-byte stride, index-aligned, Range-request friendly) and in `search/gaia-XX.json` / `search/tyc-XX.json` on-demand buckets (gaia bucket = `(id >> 35) % 256` — healpix bits; tyc bucket = `TYC1 % 256`). Optional `--max-distance-ly` quality cut (default **off**: noisy extreme Gaia distances are kept as catalog truth — CHECKPOINT 1 decision, revertible here).
- `crossmatch.py` — host ↔ star matching (Gaia → HD → HIP → name → coordinates, SPEC §5.3) → `../data/exoplanets.json`; sets the `hasExoplanets` flag bit in `stars.bin`.
  Advanced columns (issue #18): host `st_met`, `st_metratio`, `st_age`, `st_mass`, `st_logg`, `st_spectype`, `st_rotp`, `st_vsin`; planet `pl_dens`, `pl_insol`, `pl_bmassprov`, `pl_projobliq`, `pl_trueobliq`; absent → `null`.
  `*lim` convention (NASA): `1` = upper limit (`<`), `-1` = lower limit (`>`), `0`/`null` = measurement. Host values take the first non-null row and their `*lim` flag (and `st_metratio` for `st_met`) is copied from that same row.
- `transforms.py` — pure, unit-tested conversions (pc→ly, sentinels, spectral classes, color ramp + saturation boost, sizes, luminosity, flag bitmask).
- `fetch_constellations.py` — download the Stellarium modern skyculture (pinned v26.1) → `../data/raw/stellarium_modern_skyculture.json` (+ sha256 in `sources.json`).
- `build_constellations.py` — IAU constellation lines as star-index polylines (HIP → index via the names index) → `../data/constellations.json` (CC BY-SA 4.0, Stellarium). See `../NOTICE.md` §3.
- `make_fixtures.py` — regenerates the committed golden fixtures in `fixtures/` (SPEC §5.4: 1000 stars incl. Sol/Polaris/alf Cen A+B/Proxima + TRAPPIST-1 and Proxima Cen systems).
- `validate_artifacts.py` — sanity-checks the regenerated production artifacts (manifest counts vs file sizes, catalog-id stride, exoplanet hosts/planets, constellations). Used by the refresh workflow; exits non-zero on any inconsistency (SPEC §10).

Run order:

```sh
python -m venv .venv
.venv/Scripts/activate  # Windows; on POSIX: source .venv/bin/activate
pip install -r requirements.txt
python fetch_constellations.py
python fetch_athyg.py
python fetch_exoplanets.py
python build_star_binary.py
python crossmatch.py
python build_constellations.py
python make_fixtures.py        # only when refreshing the golden fixtures
pytest                         # unit + golden-fixture tests
python validate_artifacts.py   # presence + consistency of the built artifacts
```

## Periodic refresh (CI)

`.github/workflows/data-refresh.yml` runs this whole pipeline weekly (and on
manual dispatch), regenerates the artifacts, and validates them. A failed source
fetch makes the run RED rather than silently stale (SPEC §10). The publish step
is a documented fail-safe stub pending the hosting decision (the data is ~150 MB,
gitignored, CC BY-SA 4.0); see the workflow header and `docs/STATE.md`.

Generated artifacts go to `../data/` (gitignored; CC BY-SA 4.0 derivatives, see `../NOTICE.md`). The small `fixtures/` directory IS committed and uses the production filenames so it can serve as a drop-in data directory for tests.

Documented data assumptions live in the module docstrings (`transforms.py`, `build_star_binary.py`, `crossmatch.py`): luminosity derived from absmag (HYG convention), variability/multiplicity only known for HYG-sourced stars, white dwarfs → spectral class "unknown", epoch mismatch limits of the coordinate match, approximate √L habitable-zone model (Kopparapu-style conservative bounds).
