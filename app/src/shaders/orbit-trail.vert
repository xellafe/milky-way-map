// Orbit line with a fading trail behind the planet (issue #2).
attribute float aAngle;       // orbit-plane angle of the vertex, [0, 2π]
attribute float lineDistance; // cumulative length (dashes for schematic orbits)

varying float vAngle;
varying float vDist;

void main() {
  vAngle = aAngle;
  vDist = lineDistance;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
