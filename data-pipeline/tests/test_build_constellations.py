"""Unit tests for the constellation lines build (M6, SPEC §6.2)."""

from build_constellations import (
    build,
    build_hip_to_index,
    constellation_abbreviation,
    map_polyline,
)

NAMES_INDEX = {
    "0": {"proper": "Sol"},
    "10": {"hip": "100", "constellation": "Ori"},
    "11": {"hip": "200", "constellation": "Ori"},
    "12": {"hip": "300", "constellation": "Ori"},
    "13": {"hip": "400", "constellation": "Ori"},
    "14": {"hd": "555"},  # classic id but no HIP -> not line-addressable
}

HIP_TO_INDEX = build_hip_to_index(NAMES_INDEX)


def test_hip_to_index_only_maps_hip_entries():
    assert HIP_TO_INDEX == {"100": 10, "200": 11, "300": 12, "400": 13}


def test_map_polyline_full_match():
    runs, dropped = map_polyline([100, 200, 300, 400], HIP_TO_INDEX)
    assert runs == [[10, 11, 12, 13]]
    assert dropped == 0


def test_map_polyline_missing_middle_star_splits_the_run():
    runs, dropped = map_polyline([100, 200, 999, 300, 400], HIP_TO_INDEX)
    assert runs == [[10, 11], [12, 13]]
    assert dropped == 2  # 200-999 and 999-300


def test_map_polyline_missing_endpoint_drops_only_that_segment():
    runs, dropped = map_polyline([999, 100, 200], HIP_TO_INDEX)
    assert runs == [[10, 11]]
    assert dropped == 1


def test_map_polyline_no_matches():
    runs, dropped = map_polyline([1, 2, 3], HIP_TO_INDEX)
    assert runs == []
    assert dropped == 2


def test_map_polyline_single_star_runs_are_discarded():
    # 100 matches but both its segments touch missing stars: no 2-star run.
    runs, dropped = map_polyline([999, 100, 998], HIP_TO_INDEX)
    assert runs == []
    assert dropped == 2


def test_constellation_abbreviation():
    assert constellation_abbreviation("CON modern Ori") == "Ori"
    assert constellation_abbreviation("UMi") == "UMi"


def test_build_artifact_schema_and_stats():
    skyculture = {
        "id": "modern",
        "constellations": [
            {
                "id": "CON modern Ori",
                "lines": [[100, 200, 300], [400, 999]],
                "common_name": {"english": "Orion", "native": "Orion"},
            },
            {
                "id": "CON modern Xxx",
                "lines": [[997, 998]],
                "common_name": {"english": "Ghost"},
            },
        ],
    }
    artifact, stats = build(skyculture, NAMES_INDEX)

    assert stats == {
        "constellations": 2,
        "segments": 4,
        "dropped_segments": 2,
        "empty_constellations": 1,
    }
    assert artifact["license"].startswith("CC BY-SA 4.0")
    assert artifact["droppedSegments"] == 2
    ori, ghost = artifact["constellations"]
    assert ori == {"id": "Ori", "name": "Orion", "lines": [[10, 11, 12]]}
    # Fully unmatched constellations are kept (empty) so the count stays 88.
    assert ghost == {"id": "Xxx", "name": "Ghost", "lines": []}


def test_build_name_fallbacks():
    skyculture = {
        "constellations": [
            {"id": "CON modern A", "lines": [], "common_name": {"native": "NativeA"}},
            {"id": "CON modern B", "lines": []},
        ]
    }
    artifact, _ = build(skyculture, NAMES_INDEX)
    assert artifact["constellations"][0]["name"] == "NativeA"
    assert artifact["constellations"][1]["name"] == "CON modern B"
