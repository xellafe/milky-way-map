"""Pure, unit-tested transformations for the star ETL (SPEC §5.1, §6.1, §13).

Astronomical assumptions (documented per AGENTS.md):
- pc → ly conversion uses the SPEC-mandated factor 3.2616 (SPEC §2).
- HYG/AT-HYG use the sentinel distance 100000 pc for "unknown"; such entries
  (and non-finite or non-positive distances) are EXCLUDED from the 3D scene
  and counted (SPEC §1, §5.1, §10).
- Luminosity is derived from absolute V magnitude as L = 10^((4.83 - absmag)/2.5)
  (solar absolute V magnitude 4.83, no bolometric correction). This matches how
  the HYG catalog itself computes its `lum` column; AT-HYG dropped the column as
  redundant. Missing absmag → NaN, never fabricated.
- Spectral class parsing keeps only the main OBAFGKM letter. White dwarfs
  ("D..." types) and anything unparseable map to UNKNOWN (=7, SPEC §5.1).
- Colors: B–V index is mapped onto the SPEC §6.1 anchor ramp by piecewise-linear
  interpolation over typical per-class B–V values; stars without B–V fall back
  to their class anchor; unknown class → neutral white. A deliberate aesthetic
  saturation boost (COLOR_SATURATION_BOOST = 1.35, SPEC §13) plus a lightness
  floor is applied — real stars look nearly white.
- Point size derives from ABSOLUTE magnitude (SPEC §6.1): radius ∝ sqrt(L),
  i.e. 10^(-0.2 * absmag), scaled so the Sun ≈ 1.0 and clamped.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

# --- Units / sentinels (SPEC §2, §5.1) --------------------------------------

PC_TO_LY = 3.2616
HYG_DISTANCE_SENTINEL_PC = 100_000.0

# --- Spectral classes (SPEC §5.1) -------------------------------------------

SPECTRAL_CLASSES = "OBAFGKM"
SPECTRAL_UNKNOWN = 7

# --- Flags bitmask (SPEC §5.1) ----------------------------------------------

FLAG_VARIABLE = 1 << 0
FLAG_MULTIPLE = 1 << 1
FLAG_HAS_EXOPLANETS = 1 << 2

# --- Color constants (SPEC §6.1, §13) ---------------------------------------

COLOR_SATURATION_BOOST = 1.35
# Minimum HSL lightness so faint M stars stay visible (aesthetic, SPEC §13).
COLOR_LIGHTNESS_FLOOR = 0.70

# Anchor ramp: (typical B–V, hex color). B–V anchors are the conventional
# mid-class values; colors are the SPEC §6.1 anchors (M has a two-stop gradient).
_BV_COLOR_ANCHORS: list[tuple[float, str]] = [
    (-0.33, "#9BB0FF"),  # O
    (-0.20, "#AABFFF"),  # B
    (0.04, "#CAD7FF"),  # A
    (0.40, "#F8F7FF"),  # F
    (0.65, "#FFF4EA"),  # G
    (1.00, "#FFD2A1"),  # K
    (1.40, "#FFCC6F"),  # M (early)
    (2.00, "#FFA46E"),  # M (late)
]

_CLASS_ANCHOR_HEX = ["#9BB0FF", "#AABFFF", "#CAD7FF", "#F8F7FF", "#FFF4EA", "#FFD2A1", "#FFCC6F"]
NEUTRAL_WHITE = (255, 255, 255)

# --- Size constants (SPEC §6.1; aesthetic scale, documented) ------------------

SIZE_SCALE = 9.2  # chosen so the Sun (absmag 4.83) gets size ≈ 1.0
SIZE_MIN = 0.5
SIZE_MAX = 16.0

# --- Luminosity ---------------------------------------------------------------

SUN_ABSMAG_V = 4.83


def pc_to_ly(dist_pc: NDArray[np.floating]) -> NDArray[np.floating]:
    """Convert parsecs to light-years (SPEC §2: 1 pc = 3.2616 ly)."""
    return np.asarray(dist_pc, dtype=np.float64) * PC_TO_LY


def valid_distance_mask(dist_pc: NDArray[np.floating]) -> NDArray[np.bool_]:
    """True where the distance is usable for 3D placement (SPEC §1, §5.1).

    Excludes: NaN/inf, non-positive values, and the HYG sentinel 100000 pc.
    """
    d = np.asarray(dist_pc, dtype=np.float64)
    return np.isfinite(d) & (d > 0) & (d != HYG_DISTANCE_SENTINEL_PC)


def spectral_class_codes(spect: "list[str | None] | NDArray") -> NDArray[np.uint8]:
    """Map spectral type strings to 0=O … 6=M, 7=unknown (SPEC §5.1).

    Rules (documented assumption): a leading 'D' marks a white dwarf → unknown;
    otherwise the first OBAFGKM letter found (case-insensitive) wins, which
    handles prefixed types such as 'sdB' or 'dM5'.
    """
    out = np.full(len(spect), SPECTRAL_UNKNOWN, dtype=np.uint8)
    for i, raw in enumerate(spect):
        if raw is None or (isinstance(raw, float) and np.isnan(raw)):
            continue
        s = str(raw).strip().upper()
        if not s or s.startswith("D"):
            continue
        for ch in s:
            idx = SPECTRAL_CLASSES.find(ch)
            if idx >= 0:
                out[i] = idx
                break
    return out


def _hex_to_rgb01(hex_color: str) -> NDArray[np.float64]:
    h = hex_color.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)])


def _rgb_to_hsl(rgb: NDArray[np.float64]) -> tuple[NDArray, NDArray, NDArray]:
    """Vectorized RGB[N,3] in [0,1] → (h, s, l) arrays."""
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    cmax = rgb.max(axis=1)
    cmin = rgb.min(axis=1)
    delta = cmax - cmin
    l = (cmax + cmin) / 2.0

    s = np.zeros_like(l)
    nz = delta > 1e-12
    s[nz] = delta[nz] / (1.0 - np.abs(2.0 * l[nz] - 1.0))

    h = np.zeros_like(l)
    rmax = nz & (cmax == r)
    gmax = nz & (cmax == g) & ~rmax
    bmax = nz & ~rmax & ~gmax
    h[rmax] = np.mod((g[rmax] - b[rmax]) / delta[rmax], 6.0)
    h[gmax] = (b[gmax] - r[gmax]) / delta[gmax] + 2.0
    h[bmax] = (r[bmax] - g[bmax]) / delta[bmax] + 4.0
    h *= 60.0
    return h, np.clip(s, 0.0, 1.0), l


def _hsl_to_rgb(h: NDArray, s: NDArray, l: NDArray) -> NDArray[np.float64]:
    """Vectorized (h, s, l) → RGB[N,3] in [0,1]."""
    c = (1.0 - np.abs(2.0 * l - 1.0)) * s
    hp = h / 60.0
    x = c * (1.0 - np.abs(np.mod(hp, 2.0) - 1.0))
    zeros = np.zeros_like(c)

    conds = [
        (hp >= 0) & (hp < 1),
        (hp >= 1) & (hp < 2),
        (hp >= 2) & (hp < 3),
        (hp >= 3) & (hp < 4),
        (hp >= 4) & (hp < 5),
        (hp >= 5) & (hp <= 6),
    ]
    rgbs = [(c, x, zeros), (x, c, zeros), (zeros, c, x), (zeros, x, c), (x, zeros, c), (c, zeros, x)]
    r = np.select(conds, [t[0] for t in rgbs], default=0.0)
    g = np.select(conds, [t[1] for t in rgbs], default=0.0)
    b = np.select(conds, [t[2] for t in rgbs], default=0.0)
    m = l - c / 2.0
    return np.clip(np.stack([r + m, g + m, b + m], axis=1), 0.0, 1.0)


def _boost(rgb01: NDArray[np.float64]) -> NDArray[np.float64]:
    """Apply the aesthetic saturation boost + lightness floor (SPEC §13)."""
    h, s, l = _rgb_to_hsl(rgb01)
    s = np.clip(s * COLOR_SATURATION_BOOST, 0.0, 1.0)
    l = np.maximum(l, COLOR_LIGHTNESS_FLOOR)
    return _hsl_to_rgb(h, s, l)


def star_colors(
    color_index: NDArray[np.floating], spectral_codes: NDArray[np.integer]
) -> NDArray[np.uint8]:
    """Per-star RGB (uint8, [N,3]) per SPEC §6.1.

    Priority: B–V when finite → anchor-ramp interpolation; else class anchor;
    else neutral white (no boost — stays neutral, SPEC §5.1).
    """
    bv = np.asarray(color_index, dtype=np.float64)
    codes = np.asarray(spectral_codes)
    n = len(bv)

    anchor_bv = np.array([a[0] for a in _BV_COLOR_ANCHORS])
    anchor_rgb = np.stack([_hex_to_rgb01(a[1]) for a in _BV_COLOR_ANCHORS])

    rgb01 = np.ones((n, 3), dtype=np.float64)  # default neutral white

    has_bv = np.isfinite(bv)
    if has_bv.any():
        clamped = np.clip(bv[has_bv], anchor_bv[0], anchor_bv[-1])
        interp = np.stack(
            [np.interp(clamped, anchor_bv, anchor_rgb[:, ch]) for ch in range(3)], axis=1
        )
        rgb01[has_bv] = interp

    class_only = ~has_bv & (codes < SPECTRAL_UNKNOWN)
    if class_only.any():
        class_rgb = np.stack([_hex_to_rgb01(h) for h in _CLASS_ANCHOR_HEX])
        rgb01[class_only] = class_rgb[codes[class_only]]

    colored = has_bv | class_only
    if colored.any():
        rgb01[colored] = _boost(rgb01[colored])

    return np.round(rgb01 * 255.0).astype(np.uint8)


def sizes_from_absmag(absmag: NDArray[np.floating]) -> NDArray[np.float32]:
    """Point size from ABSOLUTE magnitude (SPEC §6.1): radius ∝ sqrt(L), clamped.

    size = clamp(SIZE_SCALE * 10^(-0.2 * absmag), SIZE_MIN, SIZE_MAX); the Sun ≈ 1.0.
    Missing absmag → SIZE_MIN (smallest visible dot; value not fabricated).
    """
    m = np.asarray(absmag, dtype=np.float64)
    size = SIZE_SCALE * np.power(10.0, -0.2 * m, where=np.isfinite(m), out=np.full_like(m, np.nan))
    size = np.where(np.isfinite(size), np.clip(size, SIZE_MIN, SIZE_MAX), SIZE_MIN)
    return size.astype(np.float32)


def luminosity_from_absmag(absmag: NDArray[np.floating]) -> NDArray[np.float32]:
    """L in L☉ from absolute V magnitude; NaN where absmag is missing.

    V-band proxy without bolometric correction (same convention as HYG `lum`).
    """
    m = np.asarray(absmag, dtype=np.float64)
    lum = np.power(10.0, (SUN_ABSMAG_V - m) / 2.5, where=np.isfinite(m), out=np.full_like(m, np.nan))
    return lum.astype(np.float32)


def pack_flags(
    variable: NDArray[np.bool_],
    multiple: NDArray[np.bool_],
    has_exoplanets: NDArray[np.bool_] | None = None,
) -> NDArray[np.uint8]:
    """Bitmask per SPEC §5.1: bit0 variable, bit1 multiple, bit2 hasExoplanets."""
    flags = np.zeros(len(variable), dtype=np.uint8)
    flags |= np.where(variable, FLAG_VARIABLE, 0).astype(np.uint8)
    flags |= np.where(multiple, FLAG_MULTIPLE, 0).astype(np.uint8)
    if has_exoplanets is not None:
        flags |= np.where(has_exoplanets, FLAG_HAS_EXOPLANETS, 0).astype(np.uint8)
    return flags
