// Animated host star surface (issue #16) - AESTHETIC, not data: evolving
// granulation, seeded dark spots and limb darkening. Expects noise.glsl
// prepended.

uniform float uTime;
uniform vec3 uColor;
uniform float uColorGamma;
uniform float uSpots;
uniform float uSeed;

varying vec3 vObj;
varying vec3 vViewNormal;
varying vec3 vViewPos;

// Granule spatial frequency on the unit sphere, cycles per radius (aesthetic
// choice, not data): high enough to read at ~60 px disc diameter.
const float GRANULE_FREQ = 14.0;
// Drift speeds of the two granulation fields, noise-space units per second
// (aesthetic choice, not data). Different speeds and directions make the
// pattern evolve instead of sliding rigidly.
const float DRIFT_A = 0.25;
const float DRIFT_B = 0.18;
// Darkening of the thin inter-granule lanes and amplitude of the slow
// brightness mottling, both unitless fractions (aesthetic choice, not data).
const float LANE_DARKEN = 0.16;
const float MOTTLE = 0.25;
// Lane half-width in fbm units around the n = 0.5 isosurface (aesthetic
// choice, not data): thin lanes between bright cells.
const float LANE_WIDTH = 0.1;
// Overall gain so the disc centre reaches the full star colour, unitless
// (aesthetic choice, not data).
const float SURFACE_GAIN = 1.2;
// Spot noise frequency (cycles per radius), domain-warp strength and darkening
// factor (aesthetic choice, not data): few, small, irregular, soft spots.
const float SPOT_FREQ = 7.0;
const float SPOT_WARP = 1.2;
const float SPOT_DARKEN = 0.3;
// Reference linear limb-darkening coefficient u (dimensionless): inspired by
// the Sun, not the coefficient of this star (aesthetic choice, not data).
const float LIMB_U = 0.6;
// Per-channel limb coefficients (R, G, B), mean ~ LIMB_U: darkening is stronger
// at short wavelengths, so the limb turns darker AND warmer instead of grey
// (aesthetic choice, not data).
const vec3 LIMB_U_RGB = LIMB_U + vec3(-0.2, 0.0, 0.2);

void main() {
  vec3 pa = vObj * GRANULE_FREQ + vec3(uTime * DRIFT_A, 0.0, 0.0);
  vec3 pb = vObj * GRANULE_FREQ * 1.3 + vec3(7.0, -uTime * DRIFT_B, uTime * DRIFT_B * 0.6);
  // Dark lanes sit on the n = 0.5 isosurface of the first field, which draws a
  // cellular network; the second field adds a faint brightness mottling.
  float lane = 1.0 - smoothstep(0.0, LANE_WIDTH, abs(0.65 * noise(pa) + 0.35 * noise(pa * 2.03) - 0.5));
  float granulation = 1.0 - LANE_DARKEN * lane + MOTTLE * (fbm(pb) - 0.5);

  // Domain-warped fbm thresholded high: organic blobs, no lattice edges.
  // Positioned per host by the seed; static in time.
  vec3 sp = vObj * SPOT_FREQ + uSeed * 37.0;
  vec3 warp = vec3(noise(sp + 3.1), noise(sp + 8.7), noise(sp + 15.3)) - 0.5;
  float spotNoise = fbm(sp + SPOT_WARP * warp);
  float spot = smoothstep(0.66, 0.76, spotNoise) * uSpots;

  float mu = max(dot(normalize(vViewNormal), normalize(-vViewPos)), 0.0);
  vec3 limb = 1.0 - LIMB_U_RGB * (1.0 - mu);

  vec3 col = pow(uColor, vec3(uColorGamma)) * granulation * limb * SURFACE_GAIN;
  col *= 1.0 - SPOT_DARKEN * spot;
  gl_FragColor = vec4(col, 1.0);
}
