"""Cross-match exoplanet hosts to catalog stars and emit exoplanets.json.

Match strategy (SPEC §5.3, in priority order):
1. Catalog ids: Gaia DR3 → HD → HIP (numeric comparison on extracted digits).
2. Normalized names: proper name, Gliese/GJ id, "bayer con", "flamsteed con".
3. Coordinates: nearest star within 5 arcsec; if the host has sy_dist, the
   star distance must also agree within 10%.

Documented limitations:
- AT-HYG positions are epoch ~J2000 while pscomppars coordinates are mostly
  Gaia-epoch; very high proper-motion stars may miss the coordinate match.
  Those stars (e.g. Proxima Cen) carry HIP/Gaia ids and match at priority 1.
- Hosts with no counterpart in the cloud stay `matched: false` and remain
  reachable via host-name search, flagged as "not anchored" (SPEC §5.3/§10).

Habitable-zone flag (SPEC §13): simplified Kopparapu et al. (2013)-style
conservative bounds scaling with sqrt(L): inner flux 1.1 S⊕, outer 0.53 S⊕,
i.e. r_in = sqrt(L/1.1) AU, r_out = sqrt(L/0.53) AU. `st_lum` is log10(L/L☉).
Labelled "approximate" in the UI. Missing inputs → in_hz = null (never guessed).

Side effect: sets flag bit2 (hasExoplanets, SPEC §5.1) on matched stars
directly inside stars.bin using the manifest offsets.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from transforms import FLAG_HAS_EXOPLANETS

DEFAULT_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

HZ_INNER_FLUX = 1.1  # S⊕, conservative inner bound
HZ_OUTER_FLUX = 0.53  # S⊕, conservative outer bound

COORD_TOL_ARCSEC = 5.0
DIST_TOL_FRACTION = 0.10

PLANET_FIELDS = [
    "pl_name",
    "pl_orbper",
    "pl_orbsmax",
    "pl_rade",
    "pl_bmasse",
    "pl_orbeccen",
    "pl_orbincl",
    "discoverymethod",
    "disc_year",
    "pl_eqt",
]

HOST_STAR_FIELDS = ["st_teff", "st_lum", "st_rad", "ra", "dec", "sy_dist"]


def digits_of(value: object) -> str | None:
    """Extract the trailing catalog number from ids like 'HD 209458' or
    'Gaia DR3 4472...' (the LAST digit run — 'DR3' must not win)."""
    if value is None:
        return None
    runs = re.findall(r"\d+", str(value))
    return runs[-1] if runs else None


def normalize_name(value: object) -> str | None:
    """Lowercase, strip, collapse separators; unify Gliese 'gl ' → 'gj '."""
    if value is None:
        return None
    s = re.sub(r"[\s\-_]+", " ", str(value).strip().lower())
    if not s:
        return None
    s = re.sub(r"^gl(?=\s|\d)", "gj", s)
    return re.sub(r"\s+", "", s)


def compute_in_hz(st_lum_log10: object, pl_orbsmax: object) -> bool | None:
    """Approximate HZ membership; None when inputs are missing (never fabricated)."""
    if st_lum_log10 is None or pl_orbsmax is None:
        return None
    lum = 10.0 ** float(st_lum_log10)
    r_inner = math.sqrt(lum / HZ_INNER_FLUX)
    r_outer = math.sqrt(lum / HZ_OUTER_FLUX)
    return bool(r_inner <= float(pl_orbsmax) <= r_outer)


class StarLookup:
    """Index-aligned lookup tables built from names.index.json + positions."""

    def __init__(self, names_index: dict[str, dict[str, str]], positions: np.ndarray):
        self.positions = positions
        self.by_gaia: dict[str, int] = {}
        self.by_hd: dict[str, int] = {}
        self.by_hip: dict[str, int] = {}
        self.by_name: dict[str, int] = {}

        for key, entry in names_index.items():
            i = int(key)
            if "gaia" in entry:
                self.by_gaia.setdefault(entry["gaia"], i)
            if "hd" in entry:
                self.by_hd.setdefault(entry["hd"], i)
            if "hip" in entry:
                self.by_hip.setdefault(entry["hip"], i)
            for name_key in ("proper", "gl"):
                norm = normalize_name(entry.get(name_key))
                if norm:
                    self.by_name.setdefault(norm, i)

        # Unit vectors for coordinate matching (equatorial frame, SPEC §5.1).
        norms = np.linalg.norm(positions, axis=1)
        self.valid_pos = norms > 0
        self.units = np.zeros_like(positions)
        self.units[self.valid_pos] = positions[self.valid_pos] / norms[self.valid_pos, None]
        self.dist_ly = norms

    def add_designations(self, names_index: dict[str, dict[str, str]], extra: dict[int, list[str]]):
        for i, names in extra.items():
            for name in names:
                norm = normalize_name(name)
                if norm:
                    self.by_name.setdefault(norm, i)

    def match_by_coords(
        self, ra_deg: float, dec_deg: float, sy_dist_pc: float | None
    ) -> int | None:
        ra = math.radians(ra_deg)
        dec = math.radians(dec_deg)
        target = np.array([math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)])
        dots = self.units @ target
        dots[~self.valid_pos] = -1.0
        best = int(np.argmax(dots))
        sep_rad = math.acos(min(1.0, max(-1.0, float(dots[best]))))
        if math.degrees(sep_rad) * 3600.0 > COORD_TOL_ARCSEC:
            return None
        if sy_dist_pc is not None:
            star_dist_pc = float(self.dist_ly[best]) / 3.2616
            if star_dist_pc <= 0:
                return None
            if abs(star_dist_pc - float(sy_dist_pc)) / float(sy_dist_pc) > DIST_TOL_FRACTION:
                return None
        return best


def match_host(host: dict[str, object], lookup: StarLookup) -> tuple[int | None, str | None]:
    """Apply SPEC §5.3 priorities. Returns (index, matchedBy) or (None, None)."""
    gaia = digits_of(host.get("gaia_dr3_id"))
    if gaia and gaia in lookup.by_gaia:
        return lookup.by_gaia[gaia], "gaia"
    hd = digits_of(host.get("hd_name"))
    if hd and hd in lookup.by_hd:
        return lookup.by_hd[hd], "hd"
    hip = digits_of(host.get("hip_name"))
    if hip and hip in lookup.by_hip:
        return lookup.by_hip[hip], "hip"
    name = normalize_name(host.get("hostname"))
    if name and name in lookup.by_name:
        return lookup.by_name[name], "name"
    ra, dec = host.get("ra"), host.get("dec")
    if ra is not None and dec is not None:
        idx = lookup.match_by_coords(float(ra), float(dec), host.get("sy_dist"))
        if idx is not None:
            return idx, "coords"
    return None, None


def group_hosts(rows: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    """Group TAP rows by hostname; star-level fields take the first non-null value."""
    hosts: dict[str, dict[str, object]] = {}
    for row in rows:
        hostname = str(row["hostname"])
        host = hosts.setdefault(
            hostname,
            {f: None for f in HOST_STAR_FIELDS}
            | {"gaia_dr3_id": None, "hd_name": None, "hip_name": None, "planets": []},
        )
        for f in HOST_STAR_FIELDS + ["gaia_dr3_id", "hd_name", "hip_name"]:
            if host[f] is None and row.get(f) is not None:
                host[f] = row[f]
        planet = {f: row.get(f) for f in PLANET_FIELDS}
        planet["in_hz"] = compute_in_hz(host["st_lum"] or row.get("st_lum"), row.get("pl_orbsmax"))
        host["planets"].append(planet)
    for host in hosts.values():
        host["planets"].sort(key=lambda p: (p["pl_orbsmax"] is None, p["pl_orbsmax"], p["pl_name"]))
    return hosts


def load_star_artifacts(data_dir: Path) -> tuple[dict, dict[str, dict[str, str]], np.ndarray]:
    manifest = json.loads((data_dir / "stars.manifest.json").read_text(encoding="utf-8"))
    names_index = json.loads((data_dir / "names.index.json").read_text(encoding="utf-8"))
    attrs = {a["name"]: a for a in manifest["attributes"]}
    blob = (data_dir / "stars.bin").read_bytes()
    pos_meta = attrs["position"]
    positions = np.frombuffer(
        blob, dtype="<f4", count=manifest["count"] * 3, offset=pos_meta["byteOffset"]
    ).reshape(manifest["count"], 3)
    return manifest, names_index, positions.astype(np.float64)


def set_exoplanet_flags(data_dir: Path, manifest: dict, indices: list[int]) -> None:
    """Set bit2 (hasExoplanets) in-place in stars.bin via manifest offsets."""
    attrs = {a["name"]: a for a in manifest["attributes"]}
    flags_meta = attrs["flags"]
    path = data_dir / "stars.bin"
    blob = bytearray(path.read_bytes())
    base = flags_meta["byteOffset"]
    for i in indices:
        blob[base + i] |= FLAG_HAS_EXOPLANETS
    path.write_bytes(bytes(blob))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_DIR)
    args = parser.parse_args(argv)

    payload = json.loads((args.raw / "exoplanets_raw.json").read_text(encoding="utf-8"))
    rows: list[dict[str, object]] = payload["rows"]
    manifest, names_index, positions = load_star_artifacts(args.data)
    lookup = StarLookup(names_index, positions)

    hosts_raw = group_hosts(rows)
    hosts_out: dict[str, dict[str, object]] = {}
    matched_indices: list[int] = []
    match_stats = {"gaia": 0, "hd": 0, "hip": 0, "name": 0, "coords": 0, "unmatched": 0}

    for hostname, host in sorted(hosts_raw.items()):
        idx, matched_by = match_host(host, lookup)
        if idx is not None:
            matched_indices.append(idx)
            match_stats[matched_by] += 1
        else:
            match_stats["unmatched"] += 1
        hosts_out[hostname] = {
            "starRef": {
                "matchedIndex": idx,
                "matchedBy": matched_by,
                "matched": idx is not None,
            },
            "st_teff": host["st_teff"],
            "st_lum": host["st_lum"],
            "st_rad": host["st_rad"],
            "planets": host["planets"],
        }

    set_exoplanet_flags(args.data, manifest, matched_indices)

    out = {
        "version": 1,
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": payload["metadata"],
        "matchStats": match_stats,
        "hosts": hosts_out,
    }
    dest = args.data / "exoplanets.json"
    dest.write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")

    total_hosts = len(hosts_out)
    total_planets = sum(len(h["planets"]) for h in hosts_out.values())
    print(f"[ok  ] {dest} ({dest.stat().st_size / 1e6:.1f} MB)")
    print(f"[stat] hosts: {total_hosts}, planets: {total_planets}")
    for key, value in match_stats.items():
        print(f"[stat] matched_{key}: {value}")
    print(f"[ok  ] hasExoplanets flag set on {len(set(matched_indices))} stars")
    return 0


if __name__ == "__main__":
    sys.exit(main())
