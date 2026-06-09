"""Build stars.bin + stars.manifest.json + names.index.json from AT-HYG (+ HYG).

Contract: SPEC §5.1 (SoA, little-endian, units ly, heliocentric HYG/equatorial axes).

Data/assumption notes (AGENTS.md: document every astronomical assumption):
- AT-HYG v3.3 is the primary catalog: `x0,y0,z0` are equatorial-frame Cartesian
  positions in parsecs (same axes convention as HYG), `ra` in hours, `dist` in pc.
- Part 2 of the catalog has NO header row (continuation of part 1).
- Entries without a usable distance (NaN, ≤0, or the 100000 pc HYG sentinel)
  are EXCLUDED from the scene and counted (SPEC §1/§10). Exception: Sol
  (AT-HYG id 1) legitimately has dist = 0 (origin) and is kept.
- Variability/multiplicity come from HYG v4.2 (AT-HYG does not track them),
  joined via the AT-HYG `hyg` id column:
    variable  := HYG `var` designation non-empty OR `var_min` present;
    multiple  := HYG `base` (multi-system base id) non-empty.
  Stars not in HYG have unknown variability/multiplicity → flags left at 0
  (absence of data is not fabricated into a value; the bitmask cannot encode
  "unknown", so unknown renders as "not flagged" — documented limitation).
- Luminosity is derived from absmag (see transforms.luminosity_from_absmag).
- The hasExoplanets flag (bit2) is set later by crossmatch.py.

Binary layout: all float32 sections first (4-byte aligned), then uint8 sections.
The manifest lists every attribute in SPEC §5.1 order with explicit byteOffset /
byteLength / dtype / components, so readers must use offsets, not file order.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from transforms import (
    PC_TO_LY,
    luminosity_from_absmag,
    pack_flags,
    pc_to_ly,
    sizes_from_absmag,
    spectral_class_codes,
    star_colors,
    valid_distance_mask,
)

DEFAULT_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "data"

ATHYG_PARTS = ["athyg_v33-1.csv.gz", "athyg_v33-2.csv.gz"]
HYG_FILE = "hyg_v42.csv.gz"

MANIFEST_VERSION = 1

_STRING_COLS = ["tyc", "gaia", "gl", "bayer", "flam", "con", "proper", "spect"]
_ATHYG_DTYPES: dict[str, object] = {c: "string" for c in _STRING_COLS} | {
    "id": "int64",
    "hyg": "Int64",
    "hip": "Int64",
    "hd": "Int64",
    "hr": "Int64",
}
_ATHYG_USECOLS = list(_ATHYG_DTYPES.keys()) + [
    "dist",
    "x0",
    "y0",
    "z0",
    "mag",
    "absmag",
    "ci",
]


def load_athyg(raw_dir: Path) -> pd.DataFrame:
    """Load and concatenate the two AT-HYG parts (part 2 is header-less)."""
    part1 = pd.read_csv(
        raw_dir / ATHYG_PARTS[0], dtype=_ATHYG_DTYPES, usecols=_ATHYG_USECOLS, low_memory=False
    )
    header = pd.read_csv(raw_dir / ATHYG_PARTS[0], nrows=0).columns.tolist()
    part2 = pd.read_csv(
        raw_dir / ATHYG_PARTS[1],
        header=None,
        names=header,
        dtype=_ATHYG_DTYPES,
        usecols=_ATHYG_USECOLS,
        low_memory=False,
    )
    return pd.concat([part1, part2], ignore_index=True)


def load_hyg_flags(raw_dir: Path) -> pd.DataFrame:
    """HYG v4.2 → per-HYG-id booleans: variable, multiple (see module docstring)."""
    hyg = pd.read_csv(
        raw_dir / HYG_FILE,
        usecols=["id", "var", "var_min", "base"],
        dtype={"id": "int64", "var": "string", "base": "string"},
        low_memory=False,
    )
    variable = hyg["var"].fillna("").str.strip().ne("") | hyg["var_min"].notna()
    multiple = hyg["base"].fillna("").str.strip().ne("")
    return pd.DataFrame({"hyg_id": hyg["id"], "variable": variable, "multiple": multiple})


def select_renderable(athyg: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Apply SPEC §5.1 distance filters; keep Sol; return (subset, exclusion stats)."""
    dist = athyg["dist"].to_numpy(dtype=np.float64)
    valid = valid_distance_mask(dist)
    is_sol = (athyg["id"] == 1).to_numpy() & np.isfinite(dist) & (dist == 0.0)
    keep = valid | is_sol

    finite = np.isfinite(dist)
    stats = {
        "total_catalog_rows": int(len(athyg)),
        "excluded_total": int((~keep).sum()),
        "excluded_missing_distance": int((~finite).sum()),
        "excluded_sentinel_100000pc": int((finite & (dist == 100_000.0)).sum()),
        "excluded_nonpositive_distance": int((finite & (dist <= 0.0) & ~is_sol).sum()),
        "kept_sol_at_origin": int(is_sol.sum()),
        "stars_rendered": int(keep.sum()),
    }
    return athyg.loc[keep].reset_index(drop=True), stats


def build_arrays(stars: pd.DataFrame, hyg_flags: pd.DataFrame) -> dict[str, np.ndarray]:
    """Compute every SPEC §5.1 attribute as a numpy array, index-aligned."""
    dist_pc = stars["dist"].to_numpy(dtype=np.float64)
    spect_codes = spectral_class_codes(stars["spect"].tolist())
    ci = stars["ci"].to_numpy(dtype=np.float64)
    absmag = stars["absmag"].to_numpy(dtype=np.float64)

    merged = stars[["hyg"]].merge(
        hyg_flags, how="left", left_on="hyg", right_on="hyg_id"
    )
    variable = merged["variable"].fillna(False).to_numpy(dtype=bool)
    multiple = merged["multiple"].fillna(False).to_numpy(dtype=bool)

    position = np.empty((len(stars), 3), dtype=np.float32)
    for k, col in enumerate(("x0", "y0", "z0")):
        position[:, k] = pc_to_ly(stars[col].to_numpy(dtype=np.float64)).astype(np.float32)

    n_unknown_spect = int((spect_codes == 7).sum())
    print(f"[info] stars without usable spectral type -> class 7 / neutral color: {n_unknown_spect}")

    return {
        "position": position,
        "colorRGB": star_colors(ci, spect_codes),
        "sizeAbsMag": sizes_from_absmag(absmag),
        "spectralClass": spect_codes,
        "distanceLy": (dist_pc * PC_TO_LY).astype(np.float32),
        "appMag": stars["mag"].to_numpy(dtype=np.float32),
        "absMag": absmag.astype(np.float32),
        "colorIndex": ci.astype(np.float32),
        "luminosity": luminosity_from_absmag(absmag),
        "flags": pack_flags(variable, multiple),
    }


# SPEC §5.1 attribute table order (manifest order). dtype/components per attribute.
ATTRIBUTE_SPECS: list[tuple[str, str, int]] = [
    ("position", "float32", 3),
    ("colorRGB", "uint8", 3),
    ("sizeAbsMag", "float32", 1),
    ("spectralClass", "uint8", 1),
    ("distanceLy", "float32", 1),
    ("appMag", "float32", 1),
    ("absMag", "float32", 1),
    ("colorIndex", "float32", 1),
    ("luminosity", "float32", 1),
    ("flags", "uint8", 1),
]


def pack_soa(arrays: dict[str, np.ndarray]) -> tuple[bytes, list[dict[str, object]]]:
    """Pack arrays little-endian, float32 sections first (alignment), uint8 last."""
    count = len(arrays["sizeAbsMag"])
    for name, dtype, components in ATTRIBUTE_SPECS:
        arr = arrays[name]
        expected = (count, components) if components > 1 else (count,)
        assert arr.shape == expected, f"{name}: shape {arr.shape} != {expected}"
        assert str(arr.dtype) == dtype, f"{name}: dtype {arr.dtype} != {dtype}"

    f32_first = sorted(ATTRIBUTE_SPECS, key=lambda spec: spec[1] != "float32")
    offsets: dict[str, tuple[int, int]] = {}
    chunks: list[bytes] = []
    offset = 0
    for name, dtype, _components in f32_first:
        np_dtype = "<f4" if dtype == "float32" else "u1"
        raw = np.ascontiguousarray(arrays[name]).astype(np_dtype, copy=False).tobytes()
        offsets[name] = (offset, len(raw))
        chunks.append(raw)
        offset += len(raw)

    manifest_attrs = [
        {
            "name": name,
            "dtype": dtype,
            "components": components,
            "byteOffset": offsets[name][0],
            "byteLength": offsets[name][1],
        }
        for name, dtype, components in ATTRIBUTE_SPECS
    ]
    return b"".join(chunks), manifest_attrs


def build_names_index(stars: pd.DataFrame) -> dict[str, dict[str, str]]:
    """names.index.json: index-aligned catalog ids/names (SPEC §5.1).

    All values are strings (Gaia DR3 ids exceed JS safe-integer range).
    Empty fields are omitted; stars with no usable id at all are skipped.
    """
    index: dict[str, dict[str, str]] = {}
    cols = {
        "proper": stars["proper"],
        "hd": stars["hd"],
        "hip": stars["hip"],
        "gaia": stars["gaia"],
        "gl": stars["gl"],
        "tyc": stars["tyc"],
        "constellation": stars["con"],
    }
    frames = {k: v.tolist() for k, v in cols.items()}
    for i in range(len(stars)):
        entry: dict[str, str] = {}
        for key, values in frames.items():
            v = values[i]
            if v is None or (isinstance(v, float) and np.isnan(v)) or v is pd.NA:
                continue
            s = str(v).strip()
            if s:
                entry[key] = s
        if entry:
            index[str(i)] = entry
    return index


def write_artifacts(
    out_dir: Path,
    arrays: dict[str, np.ndarray],
    names_index: dict[str, dict[str, str]],
    stats: dict[str, int],
    sources: dict[str, object] | None,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    blob, manifest_attrs = pack_soa(arrays)
    count = len(arrays["sizeAbsMag"])

    (out_dir / "stars.bin").write_bytes(blob)
    manifest = {
        "version": MANIFEST_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": count,
        "units": "ly",
        "frame": "heliocentric",
        "byteLength": len(blob),
        "attributes": manifest_attrs,
        "exclusions": stats,
        "sources": sources or {},
    }
    (out_dir / "stars.manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (out_dir / "names.index.json").write_text(
        json.dumps(names_index, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    print(f"[ok  ] {out_dir / 'stars.bin'} ({len(blob) / 1e6:.1f} MB, {count} stars)")
    print(f"[ok  ] names.index.json ({(out_dir / 'names.index.json').stat().st_size / 1e6:.1f} MB)")


def validate(arrays: dict[str, np.ndarray], stats: dict[str, int]) -> None:
    """Post-build sanity checks (M1 AC: artifacts validated against the schema)."""
    pos = arrays["position"]
    assert np.isfinite(pos).all(), "NaN/inf in positions"
    assert (arrays["distanceLy"] >= 0).all(), "negative distances"
    assert int((arrays["spectralClass"] > 7).sum()) == 0, "spectral class out of range"
    n = stats["stars_rendered"]
    assert all(len(a) == n for a in arrays.values()), "array length mismatch"
    dmax = float(arrays["distanceLy"].max())
    print(f"[info] distance range: 0 … {dmax:,.0f} ly; stars: {n:,}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args(argv)

    sources = None
    sources_path = args.raw / "sources.json"
    if sources_path.exists():
        sources = json.loads(sources_path.read_text(encoding="utf-8"))

    print("[load] AT-HYG…")
    athyg = load_athyg(args.raw)
    print(f"[load] {len(athyg):,} catalog rows")
    stars, stats = select_renderable(athyg)
    for key, value in stats.items():
        print(f"[stat] {key}: {value:,}")

    hyg_flags = load_hyg_flags(args.raw)
    arrays = build_arrays(stars, hyg_flags)
    validate(arrays, stats)
    names_index = build_names_index(stars)
    write_artifacts(args.out, arrays, names_index, stats, sources)
    return 0


if __name__ == "__main__":
    sys.exit(main())
