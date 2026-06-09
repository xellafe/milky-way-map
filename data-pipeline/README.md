# data-pipeline

Offline Python ETL for Galaxy Map (SPEC §4.1, §5).

Modules:

- `fetch_athyg.py` — download AT-HYG v3.3 + HYG v4.2 (pinned Codeberg URLs, LFS `/media/` endpoint) → `../data/raw/` + `sources.json` (sha256, timestamps).
- `fetch_exoplanets.py` — NASA Exoplanet Archive `pscomppars` via TAP sync (DOI 10.26133/NEA13) → `../data/raw/exoplanets_raw.json`.
- `build_star_binary.py` — clean + transform → `../data/stars.bin`, `stars.manifest.json`, `names.index.json` (SoA little-endian, SPEC §5.1). Logs excluded-star counts. Per the human-approved CHECKPOINT 1 split, `names.index.json` is the **classic** index (proper/HD/HIP/Gl + constellation, ~16 MB) while Gaia/TYC ids live in `catalog-ids.bin` (fixed 16-byte stride, index-aligned, Range-request friendly) and in `search/gaia-XX.json` / `search/tyc-XX.json` on-demand buckets (gaia bucket = `(id >> 35) % 256` — healpix bits; tyc bucket = `TYC1 % 256`). Optional `--max-distance-ly` quality cut (default **off**: noisy extreme Gaia distances are kept as catalog truth — CHECKPOINT 1 decision, revertible here).
- `crossmatch.py` — host ↔ star matching (Gaia → HD → HIP → name → coordinates, SPEC §5.3) → `../data/exoplanets.json`; sets the `hasExoplanets` flag bit in `stars.bin`.
- `transforms.py` — pure, unit-tested conversions (pc→ly, sentinels, spectral classes, color ramp + saturation boost, sizes, luminosity, flag bitmask).
- `make_fixtures.py` — regenerates the committed golden fixtures in `fixtures/` (SPEC §5.4: 1000 stars incl. Sol/Polaris/alf Cen A+B/Proxima + TRAPPIST-1 and Proxima Cen systems).

Run order:

```sh
python -m venv .venv
.venv/Scripts/activate  # Windows; on POSIX: source .venv/bin/activate
pip install -r requirements.txt
python fetch_athyg.py
python fetch_exoplanets.py
python build_star_binary.py
python crossmatch.py
python make_fixtures.py   # only when refreshing the golden fixtures
pytest                    # unit + golden-fixture tests
```

Generated artifacts go to `../data/` (gitignored; CC BY-SA 4.0 derivatives, see `../NOTICE.md`). The small `fixtures/` directory IS committed and uses the production filenames so it can serve as a drop-in data directory for tests.

Documented data assumptions live in the module docstrings (`transforms.py`, `build_star_binary.py`, `crossmatch.py`): luminosity derived from absmag (HYG convention), variability/multiplicity only known for HYG-sourced stars, white dwarfs → spectral class "unknown", epoch mismatch limits of the coordinate match, approximate √L habitable-zone model (Kopparapu-style conservative bounds).
