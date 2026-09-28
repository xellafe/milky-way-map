// GPU-picking vertex shader (GLSL3, skill three-points-shader / SPEC §7):
// encodes the star index (gl_VertexID — the geometry is non-indexed, so the
// vertex id IS the SoA star index) into a 24-bit RGB color. 2.5M < 2^24.
// No CPU raycasting over millions of points, ever.

uniform float uPixelScale;
uniform float uMaxPx;
uniform float uSizeGamma;
uniform float uDistExp;
uniform float uPickMinPx; // larger than the visual minimum: comfortable hover targets

in float aSize;
in float aVisible; // picking honors the runtime filters: hidden stars are unpickable

out vec3 vIdColor;

void main() {
  if (aVisible < 0.5) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vIdColor = vec3(1.0);
    return;
  }
  int id = gl_VertexID;
  vIdColor = vec3(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255)) / 255.0;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mvPosition.xyz), 1e-3);
  // Same size formula as star.vert — keep them in sync.
  float px = uPixelScale * pow(aSize, uSizeGamma) / pow(dist, uDistExp);
  gl_PointSize = clamp(px, uPickMinPx, uMaxPx);
  gl_Position = projectionMatrix * mvPosition;
}
