"""Download the Stellarium "modern" sky culture (constellation lines).

Source (pinned 2026-06-10, M6): Stellarium release tag v26.1,
skycultures/modern/index.json — 88 IAU constellations whose stick-figure
lines are sequences of Hipparcos ids (joinable with our classic names index).

License: the sky culture's description.md declares text and DATA (which
includes the line definitions) as CC BY-SA 4.0, authors "Stellarium's team" —
compatible with this project's CC BY-SA data layer (see NOTICE.md). The
original author of the western lines additionally granted MIT reuse in
github.com/Stellarium/stellarium/discussions/790. Constellation ILLUSTRATIONS
(Free Art License) are not downloaded or used.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from fetch_athyg import DEFAULT_RAW_DIR, download, sha256_of

STELLARIUM_TAG = "v26.1"
SKYCULTURE_FILENAME = "stellarium_modern_skyculture.json"
SKYCULTURE_URL = (
    "https://raw.githubusercontent.com/Stellarium/stellarium/"
    f"{STELLARIUM_TAG}/skycultures/modern/index.json"
)
SKYCULTURE_LICENSE = "CC BY-SA 4.0 (Stellarium's team, modern sky culture data)"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--force", action="store_true", help="re-download even if present")
    args = parser.parse_args(argv)

    args.out.mkdir(parents=True, exist_ok=True)
    meta_path = args.out / "sources.json"
    meta: dict[str, dict[str, object]] = {}
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))

    dest = args.out / SKYCULTURE_FILENAME
    fetched = download(SKYCULTURE_URL, dest, force=args.force)
    if fetched or SKYCULTURE_FILENAME not in meta:
        meta[SKYCULTURE_FILENAME] = {
            "url": SKYCULTURE_URL,
            "license": SKYCULTURE_LICENSE,
            "sha256": sha256_of(dest),
            "bytes": dest.stat().st_size,
            "downloaded_at": datetime.now(timezone.utc).isoformat(),
        }

    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"[ok  ] metadata written to {meta_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
