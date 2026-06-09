"""Unit tests for the M1 acceptance criteria: pc→ly conversion, sentinel
exclusion, color map (SPEC §9-M1), plus size/luminosity/flags."""

import numpy as np
import pytest

from transforms import (
    COLOR_LIGHTNESS_FLOOR,
    FLAG_HAS_EXOPLANETS,
    FLAG_MULTIPLE,
    FLAG_VARIABLE,
    HYG_DISTANCE_SENTINEL_PC,
    NEUTRAL_WHITE,
    SIZE_MAX,
    SIZE_MIN,
    SPECTRAL_UNKNOWN,
    _rgb_to_hsl,
    luminosity_from_absmag,
    pack_flags,
    pc_to_ly,
    sizes_from_absmag,
    spectral_class_codes,
    star_colors,
    valid_distance_mask,
)


class TestPcToLy:
    def test_one_parsec_is_3_2616_ly(self):
        assert pc_to_ly(np.array([1.0])) == pytest.approx([3.2616])

    def test_vectorized(self):
        np.testing.assert_allclose(
            pc_to_ly(np.array([0.0, 10.0, 100.0])), [0.0, 32.616, 326.16]
        )

    def test_proxima_distance(self):
        # Proxima Centauri ≈ 1.3 pc ≈ 4.24 ly
        assert pc_to_ly(np.array([1.3012]))[0] == pytest.approx(4.244, abs=0.01)


class TestValidDistanceMask:
    def test_excludes_hyg_sentinel(self):
        mask = valid_distance_mask(np.array([10.0, HYG_DISTANCE_SENTINEL_PC, 20.0]))
        np.testing.assert_array_equal(mask, [True, False, True])

    def test_excludes_nan_inf_nonpositive(self):
        mask = valid_distance_mask(np.array([np.nan, np.inf, -np.inf, 0.0, -5.0, 1.0]))
        np.testing.assert_array_equal(mask, [False, False, False, False, False, True])


class TestSpectralClassCodes:
    @pytest.mark.parametrize(
        ("spect", "code"),
        [
            ("O5V", 0),
            ("B2IV", 1),
            ("A1V", 2),
            ("F5IB", 3),
            ("G2V", 4),
            ("K0III", 5),
            ("M4.5Ve", 6),
            ("m2", 6),  # lowercase tolerated
            ("sdB", 1),  # subdwarf prefix
            ("DA2.5", SPECTRAL_UNKNOWN),  # white dwarf → unknown
            ("", SPECTRAL_UNKNOWN),
            (None, SPECTRAL_UNKNOWN),
            ("C5,4", SPECTRAL_UNKNOWN),  # carbon star → unknown
        ],
    )
    def test_mapping(self, spect, code):
        assert spectral_class_codes([spect])[0] == code


class TestStarColors:
    def test_unknown_star_is_neutral_white(self):
        rgb = star_colors(np.array([np.nan]), np.array([SPECTRAL_UNKNOWN]))
        assert tuple(rgb[0]) == NEUTRAL_WHITE

    def test_bv_ramp_is_blue_to_red(self):
        # blue end: B–V = -0.33 (O); red end: B–V = 2.0 (late M)
        rgb = star_colors(np.array([-0.33, 2.0]), np.array([0, 6]))
        blue_end, red_end = rgb[0].astype(int), rgb[1].astype(int)
        assert blue_end[2] > blue_end[0]  # more blue than red
        assert red_end[0] > red_end[2]  # more red than blue

    def test_class_fallback_when_bv_missing(self):
        # M star without B–V → from M anchor; must be warm (R > B)
        rgb = star_colors(np.array([np.nan]), np.array([6]))[0].astype(int)
        assert rgb[0] > rgb[2]

    def test_saturation_boost_applied(self):
        # K star: boosted saturation must be >= the raw anchor saturation
        raw = np.array([[0xFF / 255, 0xD2 / 255, 0xA1 / 255]])
        _, s_raw, _ = _rgb_to_hsl(raw)
        rgb = star_colors(np.array([1.0]), np.array([5]))[0] / 255.0
        _, s_boosted, _ = _rgb_to_hsl(rgb[None, :])
        assert s_boosted[0] >= s_raw[0]

    def test_lightness_floor(self):
        for bv in (-0.33, 0.65, 2.0):
            rgb = star_colors(np.array([bv]), np.array([SPECTRAL_UNKNOWN]))[0] / 255.0
            _, _, l = _rgb_to_hsl(rgb[None, :])
            assert l[0] >= COLOR_LIGHTNESS_FLOOR - 1e-6

    def test_bv_out_of_range_clamped(self):
        cold = star_colors(np.array([9.9]), np.array([6]))
        ref = star_colors(np.array([2.0]), np.array([6]))
        np.testing.assert_array_equal(cold, ref)


class TestSizesFromAbsmag:
    def test_sun_is_about_one(self):
        assert sizes_from_absmag(np.array([4.83]))[0] == pytest.approx(1.0, abs=0.05)

    def test_brighter_is_bigger(self):
        sizes = sizes_from_absmag(np.array([-5.0, 0.0, 5.0, 10.0]))
        assert np.all(np.diff(sizes) < 0)

    def test_clamped(self):
        sizes = sizes_from_absmag(np.array([-30.0, 30.0]))
        assert sizes[0] == pytest.approx(SIZE_MAX)
        assert sizes[1] == pytest.approx(SIZE_MIN)

    def test_missing_absmag_gets_min_size(self):
        assert sizes_from_absmag(np.array([np.nan]))[0] == pytest.approx(SIZE_MIN)


class TestLuminosity:
    def test_sun_is_one(self):
        assert luminosity_from_absmag(np.array([4.83]))[0] == pytest.approx(1.0, rel=1e-5)

    def test_five_magnitudes_is_factor_100(self):
        lum = luminosity_from_absmag(np.array([4.83 - 5.0]))
        assert lum[0] == pytest.approx(100.0, rel=1e-4)

    def test_missing_is_nan(self):
        assert np.isnan(luminosity_from_absmag(np.array([np.nan]))[0])


class TestPackFlags:
    def test_bit_layout_per_spec(self):
        assert FLAG_VARIABLE == 1
        assert FLAG_MULTIPLE == 2
        assert FLAG_HAS_EXOPLANETS == 4

    def test_combinations(self):
        flags = pack_flags(
            variable=np.array([True, False, True]),
            multiple=np.array([False, True, True]),
            has_exoplanets=np.array([False, False, True]),
        )
        np.testing.assert_array_equal(flags, [1, 2, 7])

    def test_exoplanets_optional(self):
        flags = pack_flags(np.array([False]), np.array([False]))
        assert flags[0] == 0
