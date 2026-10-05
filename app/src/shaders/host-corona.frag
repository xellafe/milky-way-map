// Radial corona glow (issue #16) - AESTHETIC, not data. Fades to zero at the
// quad edge; the star disc edge sits at radius 1 / CORONA_SCALE of the quad.

uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPulse;

varying vec2 vUv;

// Quad side / star diameter, unitless; must equal CORONA_SCALE in HostStar.tsx
// (aesthetic choice, not data).
const float CORONA_SCALE = 2.5;
// Pulse period, seconds (aesthetic choice, not data).
const float CORONA_PERIOD_S = 6.0;
// Peak glow brightness at the disc edge, unitless (aesthetic choice, not data).
const float GLOW_GAIN = 0.8;

void main() {
  float r = length(vUv - 0.5) * 2.0;
  float glow = pow((1.0 - smoothstep(1.0 / CORONA_SCALE, 1.0, r)), 3.0);
  float pulse = 1.0 + uPulse * sin(6.2831853 * uTime / CORONA_PERIOD_S);
  gl_FragColor = vec4(uColor * glow * GLOW_GAIN * uIntensity * pulse, 1.0);
}
