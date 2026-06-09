"""Generate the committed golden fixtures (SPEC §5.4).

Contents (deterministic):
- ~1000 stars: Sol + must-have stars (Polaris, alf Cen A/B, Proxima Centauri)
  + the brightest stars by apparent magnitude, ordered by AT-HYG id.
- Exoplanet systems TRAPPIST-1 and Alpha Centauri (host: Proxima Cen — the
  only Alpha Cen host currently in pscomppars; alf Cen A/B are present as
  fixture STARS) — raw rows + the cross-matched exoplanets.json.

Fixture artifacts use the exact production filenames so loaders and tests can
treat fixtures/ as a drop-in data directory.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

import crossmatch
from build_star_binary import (
    build_arrays,
    build_catalog_ids,
    build_names_index,
    load_athyg,
    load_hyg_flags,
    select_renderable,
    write_artifacts,
)

DEFAULT_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
DEFAULT_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

STAR_COUNT = 1000

# HIP ids that must be in the fixture regardless of brightness.
MUST_HAVE_HIP = {
    11767,  # Polaris (M3 AC)
    71683,  # alf Cen A
    71681,  # alf Cen B
    70890,  # Proxima Centauri (planet host)
}
FIXTURE_HOSTNAMES = {"TRAPPIST-1", "Proxima Cen"}


def select_fixture_rows(stars: pd.DataFrame) -> pd.DataFrame:
    """Sol + must-have HIPs + brightest fill, deterministic, sorted by AT-HYG id."""
    is_sol = stars["id"] == 1
    is_must = stars["hip"].isin(MUST_HAVE_HIP)
    seed_ids = set(stars.loc[is_sol | is_must, "id"])

    by_brightness = stars.sort_values(["mag", "id"], kind="stable")
    for star_id in by_brightness["id"]:
        if len(seed_ids) >= STAR_COUNT:
            break
        seed_ids.add(int(star_id))

    subset = stars[stars["id"].isin(seed_ids)].sort_values("id", kind="stable")
    return subset.reset_index(drop=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_FIXTURES_DIR)
    args = parser.parse_args(argv)

    print("[load] AT-HYG (full, then subset)…")
    athyg = load_athyg(args.raw)
    stars, _ = select_renderable(athyg)
    subset = select_fixture_rows(stars)
    print(f"[info] fixture stars: {len(subset)}")

    hyg_flags = load_hyg_flags(args.raw)
    arrays = build_arrays(subset, hyg_flags)
    names_index = build_names_index(subset)
    stats = {
        "total_catalog_rows": int(len(athyg)),
        "excluded_total": 0,
        "stars_rendered": int(len(subset)),
        "note": "golden fixture subset (SPEC §5.4), not a full catalog build",
    }
    sources = None
    sources_path = args.raw / "sources.json"
    if sources_path.exists():
        sources = json.loads(sources_path.read_text(encoding="utf-8"))
    # Search buckets are deliberately NOT generated for fixtures (256 tiny files
    # of repo noise; id-search is covered by pipeline unit tests on tmp dirs).
    write_artifacts(
        args.out, arrays, names_index, stats, sources, catalog_ids=build_catalog_ids(subset)
    )

    # Exoplanet fixture: TRAPPIST-1 + Alpha Centauri (Proxima Cen), SPEC §5.4.
    payload = json.loads((args.raw / "exoplanets_raw.json").read_text(encoding="utf-8"))
    rows = [r for r in payload["rows"] if r["hostname"] in FIXTURE_HOSTNAMES]
    fixture_payload = {"metadata": payload["metadata"] | {"fixture": True}, "rows": rows}
    (args.out / "exoplanets_raw.json").write_text(
        json.dumps(fixture_payload, indent=1), encoding="utf-8"
    )
    print(f"[info] fixture exoplanet rows: {len(rows)}")

    # Cross-match against the fixture star artifacts (also sets bit2 flags).
    crossmatch.main(["--raw", str(args.out), "--data", str(args.out)])
    return 0


if __name__ == "__main__":
    sys.exit(main())
