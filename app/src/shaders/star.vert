// Star point vertex shader (SPEC §4.2, §6.1).
// Point size derives from the precomputed absolute-magnitude size attribute,
// with perspective attenuation (~ 1/distance) and pixel clamping. Stars whose
// projected size falls below 1 px keep gl_PointSize = uMinPx but fade their
// energy with the squared sub-pixel ratio (energy-preserving, avoids popping).

uniform float uPixelScale; // px·ly, already multiplied by devicePixelRatio
uniform float uMinPx;
uniform float uMaxPx;
uniform float uSizeGamma; // >1 widens the size contrast between stars
uniform float uDistExp;   // <1 softens the distance falloff (far giants stay distinguishable)
uniform float uTime;         // seconds
uniform float uTwinkle;      // twinkle amplitude on brightness (0 = off, e.g. reduced motion)
uniform vec2 uTwinkleRange;  // ly from camera: no twinkle below .x, full above .y

attribute vec3 aColor;   // normalized uint8 -> [0,1]
attribute float aSize;   // from absolute magnitude, ~[0.5, 16], Sun ≈ 1
attribute float aVisible; // runtime filter mask (SPEC §6.5): 0 = hidden

varying vec3 vColor;
varying float vAlpha;
varying float vPx;

void main() {
  if (aVisible < 0.5) {
    // Filtered out: degenerate position outside the clip volume, zero size.
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vAlpha = 0.0;
    vPx = 0.0;
    return;
  }
  vColor = aColor;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mvPosition.xyz), 1e-3);

  // Same formula as star-pick.vert — keep them in sync.
  float px = uPixelScale * pow(aSize, uSizeGamma) / pow(dist, uDistExp);
  float sub = clamp(px / uMinPx, 0.0, 1.0);
  vAlpha = sub * sub;

  // Twinkle (aesthetic, not physical — there is no atmosphere in space):
  // per-star phase/frequency from a position hash, two incommensurate sines,
  // amplitude ramping in with distance so nearby stars stay steady.
  float h = fract(sin(dot(position.xy + position.z, vec2(12.9898, 78.233))) * 43758.5453);
  float wave = 0.5 * sin(uTime * (2.0 + 3.0 * h) + h * 6.2832)
             + 0.5 * sin(uTime * (5.0 + 4.0 * fract(h * 7.13)) + h * 14.0);
  vAlpha *= 1.0 + uTwinkle * smoothstep(uTwinkleRange.x, uTwinkleRange.y, dist) * wave;

  gl_PointSize = clamp(px, uMinPx, uMaxPx);
  vPx = gl_PointSize;
  gl_Position = projectionMatrix * mvPosition;
}
