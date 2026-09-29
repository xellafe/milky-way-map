// Star point fragment shader: "fireball" look (aesthetic, not photometric).
// White-hot core + saturated colored body + faint corona. The core/corona only
// show on resolved points (a few px); sub-resolved stars stay a pure colored
// dot so the whitening does not wash out their hue. Kept cheap — the strong
// glow still comes from the bloom post pass.
// Additive blending; color is premultiplied by the vertex alpha.

precision highp float;

uniform float uColorGamma; // per-channel power: >1 deepens hue, keeps max channel & white
uniform float uFireball;   // 1 = white core + corona, 0 = plain colored disc (realism)

varying vec3 vColor;
varying float vAlpha;
varying float vPx; // on-screen point size in px

void main() {
  vec2 fromCenter = gl_PointCoord - 0.5;
  float d = length(fromCenter) * 2.0; // 0 at center, 1 at edge
  if (d > 1.0) discard;

  // Catalog colors are pastel (lightness floor 0.70 in the pipeline); a power
  // curve pulls the weaker channels down so the hue reads clearly.
  vec3 hue = pow(vColor, vec3(uColorGamma));

  float resolved = smoothstep(3.0, 9.0, vPx) * uFireball;
  float core = exp(-d * d * 30.0) * resolved;
  float body = exp(-d * d * 6.0);
  float corona = exp(-d * 3.5) * 0.35 * resolved;

  vec3 color = hue * (body + corona) + vec3(core);
  gl_FragColor = vec4(color * vAlpha * smoothstep(1.0, 0.8, d), 1.0);
}
