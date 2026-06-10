"""Build constellations.json (star-index polylines) for the app (SPEC §6.2).

The Stellarium modern sky culture defines each constellation's stick figure
as polylines of Hipparcos ids. We map every HIP to the star's index in
stars.bin via names.index.json (built from the same catalog rows, so indices
are aligned by construction). The app then reads the 3D positions from the
star SoA at runtime — the artifact stays tiny and can never drift from the
binary.

Polylines are split around stars missing from the catalog: only runs of >= 2
consecutive matched stars survive; every segment touching a missing star is
dropped and counted (logged + recorded in the artifact, never silently).
Constellations whose lines are entirely unmatched are kept with empty lines
so the count stays 88 (the app skips them).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def build_hip_to_index(names_index: dict[str, dict[str, str]]) -> dict[str, int]:
    """Reverse map HIP id (string, as stored in the index) -> star index."""
    return {
        entry["hip"]: int(star_index)
        for star_index, entry in names_index.items()
        if "hip" in entry
    }


def map_polyline(
    hip_line: list[int], hip_to_index: dict[str, int]
) -> tuple[list[list[int]], int]:
    """Map a HIP polyline to star-index polylines, splitting at missing stars.

    Returns (runs, dropped): `runs` are maximal sub-polylines (length >= 2) of
    consecutive matched stars; `dropped` counts the segments lost because at
    least one endpoint is not in the catalog.
    """
    runs: list[list[int]] = []
    current: list[int] = []
    dropped = 0
    for hip_a, hip_b in zip(hip_line, hip_line[1:]):
        idx_a = hip_to_index.get(str(hip_a))
        idx_b = hip_to_index.get(str(hip_b))
        if idx_a is None or idx_b is None:
            dropped += 1
            if len(current) >= 2:
                runs.append(current)
            current = []
            continue
        if current:
            current.append(idx_b)
        else:
            current = [idx_a, idx_b]
    if len(current) >= 2:
        runs.append(current)
    return runs, dropped


def constellation_abbreviation(raw_id: str) -> str:
    """'CON modern Ori' -> 'Ori' (the IAU abbreviation is the last token)."""
    return raw_id.split()[-1]


def build(
    skyculture: dict, names_index: dict[str, dict[str, str]]
) -> tuple[dict, dict[str, int]]:
    """Returns (artifact dict, stats)."""
    hip_to_index = build_hip_to_index(names_index)
    constellations = []
    total_segments = 0
    dropped_segments = 0
    empty = 0
    for con in skyculture["constellations"]:
        lines: list[list[int]] = []
        for hip_line in con.get("lines", []):
            runs, dropped = map_polyline(hip_line, hip_to_index)
            lines.extend(runs)
            total_segments += max(len(hip_line) - 1, 0)
            dropped_segments += dropped
        name = con.get("common_name", {})
        constellations.append(
            {
                "id": constellation_abbreviation(con["id"]),
                "name": name.get("english") or name.get("native") or con["id"],
                "lines": lines,
            }
        )
        if not lines:
            empty += 1
    artifact = {
        "source": f"Stellarium modern sky culture ({skyculture.get('id', 'modern')})",
        "license": "CC BY-SA 4.0 (Stellarium's team)",
        "droppedSegments": dropped_segments,
        "constellations": constellations,
    }
    stats = {
        "constellations": len(constellations),
        "segments": total_segments,
        "dropped_segments": dropped_segments,
        "empty_constellations": empty,
    }
    return artifact, stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skyculture",
        type=Path,
        default=DEFAULT_DATA_DIR / "raw" / "stellarium_modern_skyculture.json",
    )
    parser.add_argument(
        "--names", type=Path, default=DEFAULT_DATA_DIR / "names.index.json"
    )
    parser.add_argument(
        "--out", type=Path, default=DEFAULT_DATA_DIR / "constellations.json"
    )
    args = parser.parse_args(argv)

    skyculture = json.loads(args.skyculture.read_text(encoding="utf-8"))
    names_index = json.loads(args.names.read_text(encoding="utf-8"))
    artifact, stats = build(skyculture, names_index)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(artifact, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"[ok  ] {args.out} — {stats['constellations']} constellations, "
        f"{stats['segments'] - stats['dropped_segments']}/{stats['segments']} segments kept "
        f"({stats['dropped_segments']} dropped), "
        f"{stats['empty_constellations']} empty"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
