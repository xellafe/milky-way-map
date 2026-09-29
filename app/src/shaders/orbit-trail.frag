// Mirrors trailAlpha() in lib/planetStyle.ts: 1 at the planet, linear fade to
// 0 uTrailLength behind it; the whole orbit keeps uBaseOpacity.
uniform vec3 uColor;
uniform float uPlanetAngle;
uniform float uTrailLength;
uniform float uBaseOpacity;
uniform vec2 uDash; // (dash, gap) in world units; dash = 0 → solid

varying float vAngle;
varying float vDist;

void main() {
  if (uDash.x > 0.0 && mod(vDist, uDash.x + uDash.y) > uDash.x) discard;
  float behind = mod(uPlanetAngle - vAngle, 6.2831853);
  float trail = behind <= uTrailLength ? 1.0 - behind / uTrailLength : 0.0;
  gl_FragColor = vec4(uColor, max(uBaseOpacity, trail));
}
