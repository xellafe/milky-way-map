// GPU-picking vertex shader (GLSL3, skill three-points-shader / SPEC §7):
// encodes the star index (gl_VertexID — the geometry is non-indexed, so the
// vertex id IS the SoA star index) into a 24-bit RGB color. 2.5M < 2^24.
// No CPU raycasting over millions of points, ever.

uniform float uPixelScale;
uniform float uMaxPx;
uniform float uPickMinPx; // larger than the visual minimum: comfortable hover targets

in float aSize;

out vec3 vIdColor;

void main() {
  int id = gl_VertexID;
  vIdColor = vec3(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255)) / 255.0;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mvPosition.xyz), 1e-3);
  gl_PointSize = clamp(uPixelScale * aSize / dist, uPickMinPx, uMaxPx);
  gl_Position = projectionMatrix * mvPosition;
}
