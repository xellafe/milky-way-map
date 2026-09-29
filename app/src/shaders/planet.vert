// System View planet sphere (issue #2, presentational). Passes the unit-sphere
// position (surface pattern coords), world position/normal (lighting from the
// host star at the origin) to planet.frag.

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vObj = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal); // uniform scale only
  gl_Position = projectionMatrix * viewMatrix * world;
}
