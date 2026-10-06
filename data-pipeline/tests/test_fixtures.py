"""Golden-fixture tests (SPEC §5.4): validate the committed fixture artifacts.

These tests run against data-pipeline/fixtures/ — deterministic files used by
rendering and cross-match tests across the project.
"""

import json
from pathlib import Path

import numpy as np
import pytest

from transforms import FLAG_HAS_EXOPLANETS

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


@pytest.fixture(scope="module")
def manifest() -> dict:
    return json.loads((FIXTURES / "stars.manifest.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def names_index() -> dict:
    return json.loads((FIXTURES / "names.index.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def exoplanets() -> dict:
    return json.loads((FIXTURES / "exoplanets.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def blob() -> bytes:
    return (FIXTURES / "stars.bin").read_bytes()


def read_attr(manifest: dict, blob: bytes, name: str) -> np.ndarray:
    meta = next(a for a in manifest["attributes"] if a["name"] == name)
    dtype = "<f4" if meta["dtype"] == "float32" else "u1"
    arr = np.frombuffer(
        blob, dtype=dtype, count=manifest["count"] * meta["components"], offset=meta["byteOffset"]
    )
    return arr.reshape(manifest["count"], meta["components"]) if meta["components"] > 1 else arr


class TestStarFixture:
    def test_manifest_schema(self, manifest, blob):
        assert manifest["count"] == 1000
        assert manifest["units"] == "ly"
        assert manifest["frame"] == "heliocentric"
        assert manifest["byteLength"] == len(blob)

    def test_positions_finite(self, manifest, blob):
        pos = read_attr(manifest, blob, "position")
        assert np.isfinite(pos).all()

    def test_must_have_stars_present(self, names_index):
        propers = {e.get("proper") for e in names_index.values()}
        assert {"Sol", "Polaris", "Rigil Kentaurus", "Toliman", "Proxima Centauri"} <= propers

    def test_classic_index_has_no_gaia_tyc(self, names_index):
        # CHECKPOINT 1 split: gaia/tyc moved to catalog-ids.bin
        for entry in names_index.values():
            assert "gaia" not in entry
            assert "tyc" not in entry

    def test_catalog_ids_fixture_present_and_aligned(self, manifest):
        ids_manifest = json.loads(
            (FIXTURES / "catalog-ids.manifest.json").read_text(encoding="utf-8")
        )
        assert ids_manifest["count"] == manifest["count"]
        size = (FIXTURES / "catalog-ids.bin").stat().st_size
        assert size == manifest["count"] * ids_manifest["strideBytes"]

    def test_proxima_distance_about_4_25_ly(self, manifest, blob, names_index):
        idx = next(
            int(i) for i, e in names_index.items() if e.get("proper") == "Proxima Centauri"
        )
        dist = read_attr(manifest, blob, "distanceLy")
        assert dist[idx] == pytest.approx(4.25, abs=0.05)

    def test_sol_is_g_class_at_origin(self, manifest, blob, names_index):
        idx = next(int(i) for i, e in names_index.items() if e.get("proper") == "Sol")
        pos = read_attr(manifest, blob, "position")
        spect = read_attr(manifest, blob, "spectralClass")
        assert np.linalg.norm(pos[idx]) < 0.01
        assert spect[idx] == 4  # G


class TestExoplanetFixture:
    def test_trappist1_has_seven_planets_unmatched(self, exoplanets):
        host = exoplanets["hosts"]["TRAPPIST-1"]
        assert host["starRef"]["matched"] is False
        assert host["starRef"]["matchedIndex"] is None
        assert len(host["planets"]) == 7
        names = [p["pl_name"] for p in host["planets"]]
        assert names == [f"TRAPPIST-1 {c}" for c in "bcdefgh"]

    def test_trappist1_b_period(self, exoplanets):
        b = exoplanets["hosts"]["TRAPPIST-1"]["planets"][0]
        assert b["pl_orbper"] == pytest.approx(1.51, abs=0.01)

    def test_proxima_matched_by_gaia(self, exoplanets, names_index):
        ref = exoplanets["hosts"]["Proxima Cen"]["starRef"]
        assert ref["matched"] is True
        assert ref["matchedBy"] == "gaia"
        assert names_index[str(ref["matchedIndex"])]["proper"] == "Proxima Centauri"

    def test_exoplanet_flag_set_on_proxima(self, exoplanets, manifest, blob):
        idx = exoplanets["hosts"]["Proxima Cen"]["starRef"]["matchedIndex"]
        flags = read_attr(manifest, blob, "flags")
        assert flags[idx] & FLAG_HAS_EXOPLANETS

    def test_flag_count_matches_matched_hosts(self, exoplanets, manifest, blob):
        flags = read_attr(manifest, blob, "flags")
        matched = {
            h["starRef"]["matchedIndex"]
            for h in exoplanets["hosts"].values()
            if h["starRef"]["matched"]
        }
        assert int((flags & FLAG_HAS_EXOPLANETS > 0).sum()) == len(matched)

    def test_nullable_fields_are_null_not_fabricated(self, exoplanets):
        for host in exoplanets["hosts"].values():
            for p in host["planets"]:
                for key in ("pl_orbper", "pl_orbsmax", "pl_orbincl", "in_hz"):
                    assert key in p  # present, possibly None — never missing

    def test_hosts_have_advanced_star_keys(self, exoplanets):
        keys = (
            "st_met", "st_metlim", "st_metratio", "st_age", "st_agelim",
            "st_mass", "st_masslim", "st_logg", "st_logglim", "st_spectype",
            "st_rotp", "st_rotplim", "st_vsin", "st_vsinlim",
        )  # fmt: skip
        for name, host in exoplanets["hosts"].items():
            for key in keys:
                assert key in host, f"{name} lacks {key}"

    def test_planets_have_advanced_keys(self, exoplanets):
        keys = (
            "pl_dens", "pl_denslim", "pl_insol", "pl_insollim", "pl_bmassprov",
            "pl_bmasselim", "pl_radelim",
            "pl_projobliq", "pl_projobliqlim", "pl_trueobliq", "pl_trueobliqlim",
        )  # fmt: skip
        for host in exoplanets["hosts"].values():
            for p in host["planets"]:
                for key in keys:
                    assert key in p, f"{p['pl_name']} lacks {key}"

    def test_doi_recorded(self, exoplanets):
        assert exoplanets["source"]["doi"] == "10.26133/NEA13"
