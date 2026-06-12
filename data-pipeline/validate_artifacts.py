"""Validate the regenerated production artifacts (SPEC §5, §8).

Run after the build/cross-match steps. Checks that every served artifact exists,
is non-empty, and is internally consistent (manifest counts match file sizes,
the catalog-id stride lines up, exoplanet hosts/planets are present). Exits
non-zero on the first failure so the refresh workflow goes RED (SPEC §10).

Usage: python validate_artifacts.py [--data ../data]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# float32 sections come first (4-byte aligned), uint8 sections after; the
# manifest byteLength is the source of truth, checked directly below.
SEARCH_BUCKETS = 256


def _fail(msg: str) -> None:
    print(f"[validate] FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def _require(path: Path) -> Path:
    if not path.is_file():
        _fail(f"missing artifact: {path}")
    if path.stat().st_size == 0:
        _fail(f"empty artifact: {path}")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_DIR)
    args = parser.parse_args()
    data: Path = args.data

    # --- stars.bin + manifest -------------------------------------------------
    stars_manifest = json.loads(_require(data / "stars.manifest.json").read_text())
    count = stars_manifest.get("count", 0)
    if count <= 0:
        _fail(f"stars manifest count is {count!r}")
    stars_bin = _require(data / "stars.bin")
    if stars_bin.stat().st_size != stars_manifest.get("byteLength"):
        _fail(
            f"stars.bin size {stars_bin.stat().st_size} != manifest byteLength "
            f"{stars_manifest.get('byteLength')}"
        )

    # --- catalog-ids.bin + manifest (fixed stride, index-aligned) -------------
    ids_manifest = json.loads(_require(data / "catalog-ids.manifest.json").read_text())
    stride = ids_manifest.get("strideBytes", 0)
    ids_bin = _require(data / "catalog-ids.bin")
    if ids_manifest.get("count") != count:
        _fail(
            f"catalog-ids count {ids_manifest.get('count')} != stars count {count}"
        )
    if stride <= 0 or ids_bin.stat().st_size != count * stride:
        _fail(
            f"catalog-ids.bin size {ids_bin.stat().st_size} != count*stride "
            f"{count}*{stride}"
        )

    # --- names index ----------------------------------------------------------
    names = json.loads(_require(data / "names.index.json").read_text())
    if not names:
        _fail("names.index.json is empty")

    # --- on-demand search buckets ---------------------------------------------
    search = data / "search"
    if not search.is_dir():
        _fail(f"missing search bucket dir: {search}")
    bucket_files = list(search.glob("*.json"))
    if not bucket_files:
        _fail("no search bucket files generated")

    # --- exoplanets -----------------------------------------------------------
    exo = json.loads(_require(data / "exoplanets.json").read_text())
    hosts = exo.get("hosts", {})
    if not hosts:
        _fail("exoplanets.json has no hosts")
    planet_count = sum(len(h.get("planets", [])) for h in hosts.values())
    if planet_count <= 0:
        _fail("exoplanets.json has no planets")

    # --- constellations -------------------------------------------------------
    constellations = json.loads(_require(data / "constellations.json").read_text())
    if not constellations:
        _fail("constellations.json is empty")

    print(
        "[validate] OK: "
        f"{count:,} stars, {len(hosts):,} hosts / {planet_count:,} planets, "
        f"{len(bucket_files)} search buckets, names index {len(names):,} entries"
    )


if __name__ == "__main__":
    main()
