# data-pipeline

Offline Python ETL for Galaxy Map (SPEC §4.1, §5). Implemented in **M1**.

Planned modules:

- `fetch_athyg.py` — download AT-HYG / HYG catalogs (Codeberg source).
- `fetch_exoplanets.py` — NASA Exoplanet Archive `pscomppars` via TAP sync.
- `build_star_binary.py` — clean + transform → `stars.bin`, `stars.manifest.json`, `names.index.json`.
- `crossmatch.py` — star ↔ exoplanet host matching (Gaia → HD → HIP → name → coordinates).
- `fixtures/` — small committed golden files (~1000 stars, TRAPPIST-1, Alpha Centauri) for tests.

Setup:

```sh
python -m venv .venv
.venv/Scripts/activate  # Windows; on POSIX: source .venv/bin/activate
pip install -r requirements.txt
```

Generated artifacts go to `../data/` (gitignored except fixtures; data licensed CC BY-SA 4.0, see `../NOTICE.md`).
