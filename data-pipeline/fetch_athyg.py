"""Download the AT-HYG and HYG star catalogs from their pinned Codeberg sources.

Sources (pinned 2026-06-09, M1):
- AT-HYG v3.3 (astronexus), CC BY-SA 4.0, split in two CSV parts.
- HYG v4.2 (astronexus), CC BY-SA 4.0 — used only for variability/multiplicity,
  which AT-HYG does not track (see AT-HYG README, "Comparison to HYG").

Files are stored under data/raw/ together with sources.json metadata
(URL, sha256, size, download timestamp) for reproducibility.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

# Codeberg serves Git-LFS content from the /media/ endpoint (raw/ returns pointers).
SOURCES: dict[str, str] = {
    "athyg_v33-1.csv.gz": "https://codeberg.org/astronexus/athyg/media/branch/main/data/athyg_v33-1.csv.gz",
    "athyg_v33-2.csv.gz": "https://codeberg.org/astronexus/athyg/media/branch/main/data/athyg_v33-2.csv.gz",
    "hyg_v42.csv.gz": "https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v42.csv.gz",
}

CATALOG_LICENSE = "CC BY-SA 4.0 (astronexus / David Nash)"
DEFAULT_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path, force: bool = False) -> bool:
    """Stream url to dest atomically. Returns True if downloaded, False if skipped."""
    if dest.exists() and not force:
        print(f"[skip] {dest.name} already present")
        return False
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"[get ] {url}")
    with requests.get(url, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        with tmp.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                fh.write(chunk)
    tmp.replace(dest)
    print(f"[ok  ] {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")
    return True


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

    for name, url in SOURCES.items():
        dest = args.out / name
        fetched = download(url, dest, force=args.force)
        if fetched or name not in meta:
            meta[name] = {
                "url": url,
                "license": CATALOG_LICENSE,
                "sha256": sha256_of(dest),
                "bytes": dest.stat().st_size,
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
            }

    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"[ok  ] metadata written to {meta_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
