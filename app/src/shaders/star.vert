// Star point vertex shader (SPEC §4.2, §6.1).
// Point size derives from the precomputed absolute-magnitude size attribute,
// with perspective attenuation (~ 1/distance) and pixel clamping. Stars whose
// projected size falls below 1 px keep gl_PointSize = uMinPx but fade their
// energy with the squared sub-pixel ratio (energy-preserving, avoids popping).

uniform float uPixelScale; // px·ly, already multiplied by devicePixelRatio
uniform float uMinPx;
uniform float uMaxPx;

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

  float px = uPixelScale * aSize / dist;
  float sub = clamp(px / uMinPx, 0.0, 1.0);
  vAlpha = sub * sub;

  gl_PointSize = clamp(px, uMinPx, uMaxPx);
  vPx = gl_PointSize;
  gl_Position = projectionMatrix * mvPosition;
}
