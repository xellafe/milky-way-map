"""Tests for the SoA packing and selection logic of build_star_binary.py."""

import json

import numpy as np
import pandas as pd
import pytest

from build_star_binary import (
    ATTRIBUTE_SPECS,
    CATALOG_IDS_DTYPE,
    build_arrays,
    build_catalog_ids,
    build_names_index,
    build_search_buckets,
    pack_soa,
    select_renderable,
    write_artifacts,
)


def make_athyg_frame() -> pd.DataFrame:
    """Synthetic AT-HYG-shaped frame: Sol, a valid star, and three invalid ones."""
    return pd.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "hyg": pd.array([0, 71456, None, None, None], dtype="Int64"),
            "hip": pd.array([None, 71681, None, None, None], dtype="Int64"),
            "hd": pd.array([None, 128621, None, None, None], dtype="Int64"),
            "hr": pd.array([None, 5460, None, None, None], dtype="Int64"),
            "tyc": pd.array([None, "9007-5849-2", "1-1-1", "2-2-2", "3-3-3"], dtype="string"),
            "gaia": pd.array(
                [None, "5853498713160606720", None, None, None], dtype="string"
            ),
            "gl": pd.array([None, "Gl 559B", None, None, None], dtype="string"),
            "bayer": pd.array([None, "alf", None, None, None], dtype="string"),
            "flam": pd.array([None, None, None, None, None], dtype="string"),
            "con": pd.array([None, "Cen", "Ori", "Ori", "Ori"], dtype="string"),
            "proper": pd.array(["Sol", "Toliman", None, None, None], dtype="string"),
            "dist": [0.0, 1.3463, np.nan, 100_000.0, -1.0],
            "x0": [0.0, -0.49, 1.0, 2.0, 3.0],
            "y0": [0.0, -0.39, 1.0, 2.0, 3.0],
            "z0": [0.0, -1.15, 1.0, 2.0, 3.0],
            "mag": [-26.7, 1.35, 9.0, 9.0, 9.0],
            "absmag": [4.85, 5.7, np.nan, np.nan, np.nan],
            "ci": [0.656, 0.9, np.nan, np.nan, np.nan],
            "spect": pd.array(["G2 V", "K1 V", None, None, None], dtype="string"),
        }
    )


def make_hyg_flags() -> pd.DataFrame:
    return pd.DataFrame(
        {"hyg_id": [0, 71456], "variable": [False, True], "multiple": [False, True]}
    )


class TestSelectRenderable:
    def test_keeps_sol_and_valid_star_excludes_others(self):
        stars, stats = select_renderable(make_athyg_frame())
        assert stats["stars_rendered"] == 2
        assert stats["kept_sol_at_origin"] == 1
        assert stats["excluded_total"] == 3
        assert stats["excluded_missing_distance"] == 1
        assert stats["excluded_sentinel_100000pc"] == 1
        assert stats["excluded_nonpositive_distance"] == 1
        assert list(stars["proper"]) == ["Sol", "Toliman"]

    def test_exclusion_stats_are_logged_consistently(self):
        _, stats = select_renderable(make_athyg_frame())
        assert (
            stats["stars_rendered"] + stats["excluded_total"] == stats["total_catalog_rows"]
        )


class TestBuildArrays:
    def test_positions_converted_to_ly(self):
        stars, _ = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        # Toliman x0 = -0.49 pc → ly
        assert arrays["position"][1, 0] == pytest.approx(-0.49 * 3.2616, rel=1e-5)

    def test_hyg_join_sets_variable_and_multiple_flags(self):
        stars, _ = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        assert arrays["flags"][0] == 0  # Sol: not variable, not multiple
        assert arrays["flags"][1] == 3  # Toliman: variable + multiple (synthetic)

    def test_luminosity_nan_when_absmag_present_only(self):
        stars, _ = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        assert np.isfinite(arrays["luminosity"]).all()


class TestPackSoa:
    def test_roundtrip_via_manifest_offsets(self):
        stars, _ = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        blob, attrs = pack_soa(arrays)

        by_name = {a["name"]: a for a in attrs}
        assert [a["name"] for a in attrs] == [s[0] for s in ATTRIBUTE_SPECS]
        assert len(blob) == sum(a["byteLength"] for a in attrs)

        for name, dtype, components in ATTRIBUTE_SPECS:
            meta = by_name[name]
            np_dtype = "<f4" if dtype == "float32" else "u1"
            raw = np.frombuffer(
                blob, dtype=np_dtype, count=len(stars) * components, offset=meta["byteOffset"]
            )
            if components > 1:
                raw = raw.reshape(len(stars), components)
            np.testing.assert_array_equal(
                raw, arrays[name], err_msg=f"attribute {name} did not roundtrip"
            )

    def test_float32_sections_are_4_byte_aligned(self):
        stars, _ = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        _, attrs = pack_soa(arrays)
        for a in attrs:
            if a["dtype"] == "float32":
                assert a["byteOffset"] % 4 == 0, f"{a['name']} misaligned"


class TestNamesIndex:
    def test_classic_index_has_no_gaia_tyc(self):
        # CHECKPOINT 1 split: gaia/tyc live in catalog-ids.bin, not here.
        stars, _ = select_renderable(make_athyg_frame())
        index = build_names_index(stars)
        assert index["0"]["proper"] == "Sol"
        assert index["1"] == {
            "proper": "Toliman",
            "hd": "128621",
            "hip": "71681",
            "gl": "Gl 559B",
            "constellation": "Cen",
        }

    def test_stars_without_classic_ids_are_skipped(self):
        frame = make_athyg_frame()
        frame.loc[2, "dist"] = 10.0  # make the tyc-only star renderable
        stars, _ = select_renderable(frame)
        index = build_names_index(stars)
        assert "2" not in index  # tyc-only → not in the classic index

    def test_all_values_are_strings(self):
        stars, _ = select_renderable(make_athyg_frame())
        for entry in build_names_index(stars).values():
            assert all(isinstance(v, str) for v in entry.values())


class TestCatalogIds:
    def test_fixed_stride_and_values(self):
        stars, _ = select_renderable(make_athyg_frame())
        ids = build_catalog_ids(stars)
        assert CATALOG_IDS_DTYPE.itemsize == 16
        assert ids["gaia"][0] == 0  # Sol: no Gaia id → 0 sentinel
        assert ids["gaia"][1] == 5853498713160606720
        assert (ids["tyc1"][1], ids["tyc2"][1], ids["tyc3"][1]) == (9007, 5849, 2)

    def test_search_buckets_route_gaia_by_healpix_bits(self):
        stars, _ = select_renderable(make_athyg_frame())
        ids = build_catalog_ids(stars)
        buckets = build_search_buckets(ids, stars["tyc"].tolist())
        g = 5853498713160606720
        # Gaia bucket uses (id >> 35) % 256 — low bits are structured, not uniform.
        gaia_bucket = buckets[f"gaia-{(g >> 35) % 256:02x}"]
        assert gaia_bucket[str(g)] == 1
        tyc_bucket = buckets[f"tyc-{9007 % 256:02x}"]
        assert tyc_bucket["9007-5849-2"] == 1

    def test_roundtrip_through_write_artifacts(self, tmp_path):
        stars, stats = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        ids = build_catalog_ids(stars)
        buckets = build_search_buckets(ids, stars["tyc"].tolist())
        write_artifacts(
            tmp_path, arrays, build_names_index(stars), stats, None, ids, buckets
        )
        raw = np.frombuffer((tmp_path / "catalog-ids.bin").read_bytes(), dtype=CATALOG_IDS_DTYPE)
        np.testing.assert_array_equal(raw["gaia"], ids["gaia"])
        manifest = json.loads((tmp_path / "catalog-ids.manifest.json").read_text())
        assert manifest["strideBytes"] == 16
        assert (tmp_path / "search").is_dir()


class TestWriteArtifacts:
    def test_manifest_schema(self, tmp_path):
        stars, stats = select_renderable(make_athyg_frame())
        arrays = build_arrays(stars, make_hyg_flags())
        write_artifacts(tmp_path, arrays, build_names_index(stars), stats, {"src": "test"})

        manifest = json.loads((tmp_path / "stars.manifest.json").read_text())
        assert manifest["count"] == 2
        assert manifest["units"] == "ly"
        assert manifest["frame"] == "heliocentric"
        assert manifest["byteLength"] == (tmp_path / "stars.bin").stat().st_size
        assert {a["name"] for a in manifest["attributes"]} == {s[0] for s in ATTRIBUTE_SPECS}
        assert manifest["exclusions"]["stars_rendered"] == 2

        names = json.loads((tmp_path / "names.index.json").read_text())
        assert names["0"]["proper"] == "Sol"
