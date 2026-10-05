// Habitable-zone ring: warm (too hot) -> green -> cool (too cold) gradient,
// soft fade to both edges and thin constant-pixel-width boundary lines.

uniform float uInner;
uniform float uOuter;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCold;
// Body opacity, edge fade span (fraction of the band), line width (px) and
// line opacity: aesthetic choices, not data.
const float BODY_ALPHA = 0.2;
const float EDGE_FADE = 0.25;
const float LINE_PX = 1.0;
const float LINE_ALPHA = 0.7;

varying float vRadius;

void main() {
  // Derivatives use the unclamped ratio: clamping flattens them at edge helpers.
  float tRaw = (vRadius - uInner) / (uOuter - uInner);
  float t = clamp(tRaw, 0.0, 1.0);
  vec3 col = t < 0.5 ? mix(uHot, uMid, t * 2.0) : mix(uMid, uCold, t * 2.0 - 1.0);

  float body = smoothstep(0.0, EDGE_FADE, t) * smoothstep(0.0, EDGE_FADE, 1.0 - t) * BODY_ALPHA;
  // fwidth(tRaw) is t per pixel, so this distance is in pixels at any zoom.
  float edgePx = min(t, 1.0 - t) / max(fwidth(tRaw), 1e-6);
  float line = (1.0 - smoothstep(LINE_PX * 0.5, LINE_PX * 1.5, edgePx)) * LINE_ALPHA;

  gl_FragColor = vec4(col, max(body, line));
}
