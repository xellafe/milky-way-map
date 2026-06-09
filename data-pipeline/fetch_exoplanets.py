"""Fetch confirmed exoplanets from the NASA Exoplanet Archive (TAP sync).

Table: `pscomppars` (Planetary Systems Composite Parameters).
DOI (verified on https://exoplanetarchive.ipac.caltech.edu/docs/doi.html on
2026-06-09): 10.26133/NEA13 — recorded in NOTICE.md.

Column note (documented deviation from the SPEC §5.2 example query):
`pscomppars` has no `gaia_id` column; the actual columns are `gaia_dr3_id`
and `gaia_dr2_id`. `sy_dist` (system distance, pc) is also fetched to make
the coordinate-based cross-match (SPEC §5.3 priority 3) robust.

Output: data/raw/exoplanets_raw.json (the TAP JSON rows + fetch metadata).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

TAP_SYNC_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
PSCOMPPARS_DOI = "10.26133/NEA13"

COLUMNS = [
    "pl_name",
    "hostname",
    "hd_name",
    "hip_name",
    "gaia_dr3_id",
    "gaia_dr2_id",
    "pl_orbper",
    "pl_orbsmax",
    "pl_rade",
    "pl_bmasse",
    "pl_orbeccen",
    "pl_orbincl",
    "discoverymethod",
    "disc_year",
    "pl_eqt",
    "st_teff",
    "st_lum",
    "st_rad",
    "ra",
    "dec",
    "sy_dist",
]

ADQL = f"select {','.join(COLUMNS)} from pscomppars"

DEFAULT_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def fetch_pscomppars() -> list[dict[str, object]]:
    url = f"{TAP_SYNC_URL}?query={quote(ADQL)}&format=json"
    print(f"[get ] {url}")
    resp = requests.get(url, timeout=300)
    resp.raise_for_status()
    rows = resp.json()
    if not isinstance(rows, list) or not rows:
        raise RuntimeError(f"unexpected TAP response: {str(rows)[:200]}")
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_RAW_DIR)
    args = parser.parse_args(argv)

    rows = fetch_pscomppars()
    print(f"[ok  ] {len(rows)} planet rows fetched")

    args.out.mkdir(parents=True, exist_ok=True)
    payload = {
        "metadata": {
            "table": "pscomppars",
            "doi": PSCOMPPARS_DOI,
            "adql": ADQL,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "row_count": len(rows),
            "acknowledgment": (
                "This research has made use of the NASA Exoplanet Archive, which is "
                "operated by the California Institute of Technology, under contract "
                "with the National Aeronautics and Space Administration under the "
                "Exoplanet Exploration Program."
            ),
        },
        "rows": rows,
    }
    dest = args.out / "exoplanets_raw.json"
    dest.write_text(json.dumps(payload), encoding="utf-8")
    print(f"[ok  ] {dest} ({dest.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
