// GPU-picking fragment shader: hard round point, flat ID color.
// Background clears to white (0xFFFFFF = "no star": id >= count).

in vec3 vIdColor;

out vec4 outColor;

void main() {
  vec2 fromCenter = gl_PointCoord - 0.5;
  if (dot(fromCenter, fromCenter) > 0.25) discard;
  outColor = vec4(vIdColor, 1.0);
}
