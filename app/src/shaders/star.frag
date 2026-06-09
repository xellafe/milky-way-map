// Star point fragment shader: soft round point with gaussian-ish falloff.
// Kept cheap on purpose — the strong glow comes from the bloom post pass.
// Additive blending; color is premultiplied by the vertex alpha.

precision highp float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 fromCenter = gl_PointCoord - 0.5;
  float d = length(fromCenter) * 2.0; // 0 at center, 1 at edge
  if (d > 1.0) discard;

  float falloff = exp(-d * d * 5.0) * smoothstep(1.0, 0.7, d);
  gl_FragColor = vec4(vColor * vAlpha * falloff, 1.0);
}
