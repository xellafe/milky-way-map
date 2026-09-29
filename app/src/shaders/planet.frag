// Procedural planet surface per size class (issue #2) — AESTHETIC, not data:
// 0 rocky (fbm terrain), 1 sub-Neptune (hazy faint bands), 2 giant (turbulent
// bands), 3 unknown (plain neutral). Lit by the host star at the origin with a
// soft terminator; fresnel rim = atmosphere. Keep uType in sync with
// PLANET_TYPE_INDEX (lib/planetStyle.ts).

uniform int uType;
uniform float uSeed;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 p = vObj + uSeed * 37.0;
  vec3 col;
  float rim;

  if (uType == 0) {
    float n = fbm(p * 2.5);
    col = mix(uColorA, uColorB, smoothstep(0.35, 0.65, n));
    col = mix(col, uColorC, smoothstep(0.62, 0.8, fbm(p * 6.0)) * 0.6);
    rim = 0.15;
  } else if (uType == 1) {
    float t = vObj.y * 9.0 + fbm(p * 2.0) * 1.5;
    col = mix(uColorA, uColorB, 0.5 + 0.2 * sin(t));
    col = mix(col, uColorC, 0.15);
    rim = 0.6;
  } else if (uType == 2) {
    float t = vObj.y * 14.0 + fbm(p * vec3(1.5, 4.0, 1.5)) * 3.0;
    col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(t));
    col = mix(col, uColorC, smoothstep(0.55, 1.0, sin(t * 0.5 + 1.3)) * 0.5);
    rim = 0.45;
  } else {
    col = uColorA * (0.92 + 0.16 * fbm(p * 3.0));
    rim = 0.1;
  }

  vec3 N = normalize(vNormal);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, L);
  float day = smoothstep(-0.15, 0.35, ndl);
  col *= 0.06 + 0.94 * day;

  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += mix(uColorB, vec3(1.0), 0.3) * fres * rim * (0.25 + 0.75 * smoothstep(-0.3, 0.5, ndl));

  gl_FragColor = vec4(col, 1.0);
}
