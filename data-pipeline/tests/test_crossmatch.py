"""Tests for cross-match logic (SPEC §5.3) and the HZ model (SPEC §13)."""

import numpy as np
import pytest

from crossmatch import (
    StarLookup,
    compute_in_hz,
    digits_of,
    group_hosts,
    match_host,
    normalize_name,
)
from transforms import PC_TO_LY


class TestNormalization:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("HD 209458", "209458"),
            ("HIP  12345", "12345"),
            ("Gaia DR3 4472832130942575872", "4472832130942575872"),
            ("no digits", None),
            (None, None),
        ],
    )
    def test_digits_of(self, raw, expected):
        assert digits_of(raw) == expected

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("TRAPPIST-1", "trappist1"),
            ("Proxima  Cen", "proximacen"),
            ("Gl 551", "gj551"),
            ("GJ 551", "gj551"),
            ("gl551", "gj551"),
            ("  ", None),
            (None, None),
        ],
    )
    def test_normalize_name(self, raw, expected):
        assert normalize_name(raw) == expected


class TestInHz:
    def test_earth_is_in_hz(self):
        # Sun: log10(L) = 0, Earth a = 1 AU → inside [0.953, 1.374] AU
        assert compute_in_hz(0.0, 1.0) is True

    def test_mercury_is_not(self):
        assert compute_in_hz(0.0, 0.387) is False

    def test_missing_inputs_give_none(self):
        assert compute_in_hz(None, 1.0) is None
        assert compute_in_hz(0.0, None) is None


def make_lookup() -> StarLookup:
    # Star 0: Sol at origin; star 1 at 1.3 pc toward (ra=219.9°, dec=-60.8°)-ish;
    # star 2 far away at 100 pc on the +x axis.
    names_index = {
        "0": {"proper": "Sol"},
        "1": {
            "proper": "Rigil Kentaurus",
            "hd": "128620",
            "hip": "71683",
            "gl": "Gl 559A",
        },
        "2": {"proper": "FarStar"},
    }
    # Gaia ids now arrive via catalog-ids (CHECKPOINT 1 split), index-aligned.
    gaia_ids = np.array([0, 5853498713190525696, 0], dtype="<u8")
    ra1, dec1 = np.radians(219.9), np.radians(-60.83)
    r1 = 1.3463 * PC_TO_LY
    pos1 = [
        r1 * np.cos(dec1) * np.cos(ra1),
        r1 * np.cos(dec1) * np.sin(ra1),
        r1 * np.sin(dec1),
    ]
    positions = np.array([[0.0, 0.0, 0.0], pos1, [100.0 * PC_TO_LY, 0.0, 0.0]])
    return StarLookup(names_index, positions, gaia_ids)


class TestMatchPriority:
    def test_gaia_wins_over_hd(self):
        host = {
            "gaia_dr3_id": "Gaia DR3 5853498713190525696",
            "hd_name": "HD 128620",
            "hostname": "alf Cen A",
        }
        idx, by = match_host(host, make_lookup())
        assert (idx, by) == (1, "gaia")

    def test_hd_when_no_gaia(self):
        idx, by = match_host({"hd_name": "HD 128620", "hostname": "x"}, make_lookup())
        assert (idx, by) == (1, "hd")

    def test_hip_when_no_gaia_hd(self):
        idx, by = match_host({"hip_name": "HIP 71683", "hostname": "x"}, make_lookup())
        assert (idx, by) == (1, "hip")

    def test_name_normalized(self):
        idx, by = match_host({"hostname": "Rigil  Kentaurus"}, make_lookup())
        assert (idx, by) == (1, "name")

    def test_gliese_name(self):
        idx, by = match_host({"hostname": "GJ 559 A"}, make_lookup())
        assert (idx, by) == (1, "name")

    def test_coords_fallback(self):
        idx, by = match_host(
            {"hostname": "Unknown", "ra": 219.9, "dec": -60.83, "sy_dist": 1.3463},
            make_lookup(),
        )
        assert (idx, by) == (1, "coords")

    def test_coords_rejected_when_distance_disagrees(self):
        idx, by = match_host(
            {"hostname": "Unknown", "ra": 219.9, "dec": -60.83, "sy_dist": 50.0},
            make_lookup(),
        )
        assert (idx, by) == (None, None)

    def test_unmatched_host(self):
        idx, by = match_host({"hostname": "TRAPPIST-1", "ra": 346.6, "dec": -5.04}, make_lookup())
        assert (idx, by) == (None, None)


class TestGroupHosts:
    def test_groups_planets_and_first_nonnull_star_fields(self):
        rows = [
            {
                "hostname": "X-1",
                "pl_name": "X-1 c",
                "pl_orbsmax": 0.2,
                "st_teff": None,
                "st_lum": 0.0,
                "pl_orbper": 30.0,
            },
            {
                "hostname": "X-1",
                "pl_name": "X-1 b",
                "pl_orbsmax": 0.1,
                "st_teff": 5700,
                "st_lum": 0.0,
                "pl_orbper": 10.0,
            },
        ]
        hosts = group_hosts(rows)
        assert hosts["X-1"]["st_teff"] == 5700
        assert hosts["X-1"]["st_lum"] == 0.0
        # planets sorted by semi-major axis
        assert [p["pl_name"] for p in hosts["X-1"]["planets"]] == ["X-1 b", "X-1 c"]

    def test_new_host_fields_first_nonnull(self):
        rows = [
            {"hostname": "M", "pl_name": "M b", "st_met": None},
            {"hostname": "M", "pl_name": "M c", "st_met": 0.1, "st_metlim": 0},
        ]
        host = group_hosts(rows)["M"]
        assert host["st_met"] == 0.1
        assert host["st_metlim"] == 0

    def test_value_and_limit_from_same_row(self):
        rows = [
            {"hostname": "A", "pl_name": "A b", "st_age": None, "st_agelim": 1},
            {"hostname": "A", "pl_name": "A c", "st_age": 5.0, "st_agelim": 0},
        ]
        host = group_hosts(rows)["A"]
        assert host["st_age"] == 5.0
        assert host["st_agelim"] == 0

    def test_metallicity_ratio_from_same_row_as_value(self):
        rows = [
            {"hostname": "Z", "pl_name": "Z b", "st_met": None, "st_metratio": "[M/H]"},
            {"hostname": "Z", "pl_name": "Z c", "st_met": 0.1, "st_metratio": "[Fe/H]"},
        ]
        assert group_hosts(rows)["Z"]["st_metratio"] == "[Fe/H]"

    def test_new_planet_fields_passthrough(self):
        rows = [
            {
                "hostname": "P",
                "pl_name": "P b",
                "pl_dens": 5.5,
                "pl_bmassprov": "Mass",
                "pl_projobliq": 10.0,
                "pl_projobliqlim": 0,
            },
            {"hostname": "P", "pl_name": "P c", "pl_orbsmax": 2.0},
        ]
        by_name = {p["pl_name"]: p for p in group_hosts(rows)["P"]["planets"]}
        b = by_name["P b"]
        assert (b["pl_dens"], b["pl_bmassprov"]) == (5.5, "Mass")
        assert (b["pl_projobliq"], b["pl_projobliqlim"]) == (10.0, 0)
        c = by_name["P c"]
        for key in ("pl_dens", "pl_bmassprov", "pl_projobliq", "pl_projobliqlim"):
            assert c[key] is None

    def test_in_hz_computed_per_planet(self):
        rows = [
            {"hostname": "S", "pl_name": "S b", "pl_orbsmax": 1.0, "st_lum": 0.0},
            {"hostname": "S", "pl_name": "S c", "pl_orbsmax": None, "st_lum": 0.0},
        ]
        hosts = group_hosts(rows)
        by_name = {p["pl_name"]: p for p in hosts["S"]["planets"]}
        assert by_name["S b"]["in_hz"] is True
        assert by_name["S c"]["in_hz"] is None

    def test_missing_planet_fields_are_none(self):
        hosts = group_hosts([{"hostname": "Y", "pl_name": "Y b"}])
        planet = hosts["Y"]["planets"][0]
        assert planet["pl_orbincl"] is None
        assert planet["pl_orbper"] is None
