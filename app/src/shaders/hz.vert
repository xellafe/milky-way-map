// Habitable-zone ring: passes the radial distance in AU (ring lies in local XY).

varying float vRadius;

void main() {
  vRadius = length(position.xy);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
