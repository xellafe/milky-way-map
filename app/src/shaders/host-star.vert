// Host star sphere in System View (issue #16): unit-sphere position for the
// surface pattern, view-space normal/position for limb darkening.

varying vec3 vObj;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vObj = normalize(position);
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vViewPos = view.xyz;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * view;
}
