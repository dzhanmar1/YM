import React, { useEffect, useRef } from 'react';
import { audioVisualizer } from '../utils/audioVisualizer';
import { usePlayerStore } from '../store/playerStore';

export interface WaveVisualizerOrbProps {
  onTogglePlay: () => void;
  isPlaying: boolean;
  /** Hide central glass button (e.g. when play button is placed next to title) */
  hideCenterButton?: boolean;
  /** Renders full-viewport deep-space nebula + anamorphic spark shader behind the page */
  showAmbientBackground?: boolean;
  className?: string;
}

type RGB = [number, number, number];
type ShapeWeights = [number, number, number]; // [favorite: Sphere, discover: Prism, popular: Crown]

interface AuraPalette {
  c1: RGB;
  c2: RGB;
  c3: RGB;
}

// Calibrated DSP Gain Constants (YM Aura v2 Studio)
const SUB_GAIN = 1.00;
const MID_GAIN = 1.45;
const HIGH_GAIN = 2.10;
const KICK_GATE_MULT = 1.00;
const DROP_GLOW_BOOST = 1.00;

const PALETTES: Record<string, AuraPalette> = {
  active:            { c1: [1.00, 0.23, 0.36], c2: [0.47, 0.16, 0.79], c3: [1.00, 0.42, 0.21] },
  fun:               { c1: [1.00, 0.30, 0.48], c2: [1.00, 0.62, 0.17], c3: [0.78, 0.22, 0.84] },
  calm:              { c1: [0.00, 0.44, 0.95], c2: [0.00, 0.96, 0.83], c3: [0.28, 0.22, 0.82] },
  sad:               { c1: [0.22, 0.36, 0.92], c2: [0.45, 0.22, 0.88], c3: [0.38, 0.72, 0.98] },
  driving:           { c1: [1.00, 0.18, 0.38], c2: [0.47, 0.16, 0.79], c3: [0.00, 0.83, 1.00] },
  'work-background': { c1: [0.12, 0.38, 1.00], c2: [0.00, 0.96, 0.83], c3: [0.43, 0.36, 0.96] },
  workout:           { c1: [1.00, 0.23, 0.36], c2: [1.00, 0.42, 0.21], c3: [0.85, 0.12, 0.54] },
  'wake-up':         { c1: [1.00, 0.48, 0.24], c2: [1.00, 0.29, 0.49], c3: [1.00, 0.82, 0.40] },
  'fall-asleep':     { c1: [0.24, 0.20, 0.68], c2: [0.38, 0.14, 0.74], c3: [0.22, 0.74, 0.97] },
};

const CHARACTER_SHAPES: Record<string, ShapeWeights> = {
  favorite: [1, 0, 0],
  discover: [0, 1, 0],
  popular:  [0, 0, 1],
};

const BAND_RANGES: ReadonlyArray<[number, number]> = [
  [0, 2], [2, 4], [4, 6], [6, 9],
  [9, 13], [13, 18], [18, 24], [24, 31],
  [31, 39], [39, 48], [48, 58], [58, 69],
  [69, 81], [81, 94], [94, 108], [108, 124],
];

const PARTICLE_COUNT = 140;
const HISTORY_LEN = 36;

const QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const BG_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2  u_resolution;
uniform vec2  u_orbCenter;
uniform float u_bgPhase;
uniform float u_subBass;
uniform float u_mid;
uniform float u_treble;
uniform float u_kick;
uniform float u_drop;
uniform vec2  u_shocks[4];
uniform vec3  u_col1;
uniform vec3  u_col2;
uniform vec3  u_col3;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = m * p * 2.02 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  vec2 center = vec2(u_orbCenter.x * aspect, u_orbCenter.y);
  vec2 dVec = p - center;
  float dist = length(dVec);

  // Deep space #10131C surface
  vec3 col = vec3(0.0627, 0.0745, 0.1098);

  // Flowing cosmic FBM nebula clouds
  float n1 = fbm2(p * 1.15 + vec2(u_bgPhase * 0.06, u_bgPhase * 0.035));
  float n2 = fbm2(p * 1.78 + vec2(n1 * 0.88) + vec2(-u_bgPhase * 0.045, u_bgPhase * 0.055));

  vec3 cloudCol = mix(u_col2, u_col1, smoothstep(0.22, 0.78, n2));
  cloudCol = mix(cloudCol, u_col3, 0.30 * smoothstep(0.45, 0.92, n1));

  // Nebula illumination: deep & calm at rest -> rich wide flood during drops & sub-bass
  float dropClamped = clamp(u_drop, 0.0, 1.35);
  float nebulaMask = exp(-dist * (1.28 - min(dropClamped, 1.15) * 0.58));
  float calmNebula = 0.055 + n2 * 0.085 + u_mid * 0.065;
  float dropNebula = dropClamped * (0.36 + n2 * 0.30) + u_subBass * (0.20 + n1 * 0.16);
  col += cloudCol * (calmNebula + dropNebula) * nebulaMask;

  // Signature Anamorphic Spark ("Искра") stretching horizontally behind the orb
  float sparkStretchX = 0.42 - min(dropClamped, 1.15) * 0.16 - u_subBass * 0.06;
  float sparkPinchY   = 3.40 - min(dropClamped, 1.15) * 0.75 - u_subBass * 0.35;
  vec2 anamMain = dVec * vec2(max(0.18, sparkStretchX), max(1.9, sparkPinchY));
  float sparkStreak = exp(-dot(anamMain, anamMain) * (2.55 - min(dropClamped, 1.1) * 0.95));

  // Fine razor core inside the horizontal anamorphic spark
  vec2 anamRazor = dVec * vec2(max(0.24, sparkStretchX * 1.18), 6.2 - min(dropClamped, 1.0) * 1.2);
  float sparkRazor = exp(-dot(anamRazor, anamRazor) * 2.2);

  // Subtle vertical & diagonal secondary cross-glint ("крестовина искры")
  vec2 crossVert = dVec * vec2(3.1 - u_subBass * 0.45, 0.74 - min(dropClamped, 1.0) * 0.18);
  float sparkCross = exp(-dot(crossVert, crossVert) * 3.1);

  float cs = 0.9239, sn = 0.3827; // subtle 22.5 deg optical glint
  vec2 dDiag = vec2(dVec.x * cs - dVec.y * sn, dVec.x * sn + dVec.y * cs);
  vec2 anamDiag = dDiag * vec2(0.85, 4.6);
  float sparkDiag = exp(-dot(anamDiag, anamDiag) * 2.9) * 0.42;

  vec3 sparkCol = mix(u_col1, u_col3, 0.38 + 0.18 * sin(u_bgPhase * 0.6));
  vec3 sparkDeep = mix(u_col2, u_col1, 0.62);

  // Darker, richly saturated spark response on kicks; expansive luminous bloom on drops/sub-bass
  float sparkEnergy = 0.075 + u_subBass * 0.24 + dropClamped * 0.36 + u_kick * 0.14;
  col += sparkDeep * sparkStreak * sparkEnergy * 1.08;
  col += sparkCol  * sparkRazor  * (0.045 + u_subBass * 0.15 + dropClamped * 0.24 + u_treble * 0.08 + u_kick * 0.10);
  col += mix(u_col2, u_col3, 0.48) * (sparkCross + sparkDiag) * (0.032 + u_mid * 0.075 + u_subBass * 0.11 + dropClamped * 0.16);

  // Subtle darker atmospheric shock-ripple across nebula clouds on kicks
  for (int i = 0; i < 4; i++) {
    float age = u_shocks[i].x;
    float str = u_shocks[i].y;
    if (age > 0.0 && age < 1.0) {
      float prog = 1.0 - pow(1.0 - age, 2.0);
      float waveR = 0.32 + prog * 1.85;
      float band = exp(-pow((dist - waveR) / (0.14 + prog * 0.22), 2.0));
      float env = smoothstep(0.0, 0.08, age) * pow(1.0 - age, 2.1);
      col += mix(u_col2, u_col1, 0.65) * band * env * str * (0.055 + dropClamped * 0.11) * (0.6 + 0.55 * n2);
    }
  }

  // Deep-space twinkling stars boosted delicately by treble
  vec2 starCoord = (p + vec2(u_bgPhase * 0.007, 0.0)) * 34.0;
  vec2 starCell = floor(starCoord);
  vec2 starLocal = fract(starCoord) - 0.5;
  float rnd = hash21(starCell);
  if (rnd > 0.985) {
    float twinkle = 0.45 + 0.55 * sin(u_bgPhase * 2.2 + rnd * 120.0);
    float star = smoothstep(0.16, 0.0, length(starLocal)) * twinkle * (0.28 + u_treble * 0.26);
    col += mix(vec3(0.84, 0.90, 1.0), u_col3, 0.40) * star;
  }

  // Relaxing vignette on drops so the whole dark canvas breathes with colored light
  float vigStrength = mix(0.42, 0.16, clamp(dropClamped, 0.0, 1.0));
  col *= 1.0 - smoothstep(0.82, 2.35, dist) * vigStrength;

  // Saturated filmic rolloff (keeps colors deep & rich, never flat white)
  col = col / (1.0 + col * 0.28);

  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(max(col + dither, 0.0), 1.0);
}`;

const ORB_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2  u_resolution;
uniform float u_coreSpin;
uniform float u_flowPhase;
uniform float u_breathPhase;
uniform float u_subBass;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_kick;
uniform float u_drop;
uniform float u_playBlend;
uniform float u_shockBaseR;
uniform vec3  u_shapeWeights;
uniform float u_bands[16];
uniform vec2  u_shocks[4];
uniform vec3  u_col1;
uniform vec3  u_col2;
uniform vec3  u_col3;

vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbmSmooth(vec3 p) {
  float v = 0.0;
  float a = 0.52;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p = p * 1.92 + vec3(1.7, 2.3, 0.9);
    a *= 0.48;
  }
  return v;
}

mat2 rot2D(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float sampleBand(float t) {
  float idx = clamp(t, 0.0, 1.0) * 15.0;
  int i0 = int(floor(idx));
  int i1 = min(i0 + 1, 15);
  float f = fract(idx);
  return mix(u_bands[i0], u_bands[i1], f * f * (3.0 - 2.0 * f));
}

float evalOrbRadius(vec2 p) {
  float ang = atan(p.y, p.x);

  // Poised, calm organic breathing at rest & during quiet passages
  float calmFactor = 1.0 - clamp(u_subBass * 0.55 + u_drop * 0.45, 0.0, 0.78);
  float idleBreath = sin(u_breathPhase) * 0.014 * calmFactor;
  float idleWave = (
    sin(ang * 2.0 - u_flowPhase * 0.65) * 0.009 +
    cos(ang * 3.0 - u_flowPhase * 0.48) * 0.005
  ) * calmFactor;

  // 1) Uniform radial expansion (baseR): asymptotically soft-compressed via tanh (~0.36 -> ~0.475)
  float subExpand  = u_subBass * 0.078;
  float kickPunch  = u_kick * 0.028;
  float dropExpand = clamp(u_drop, 0.0, 1.5) * 0.022;
  float baseR = 0.36 + idleBreath + 0.115 * tanh((subExpand + kickPunch + dropExpand) / 0.115);

  // 2) Zero-mean sculptural character silhouettes
  // Silhouette 1: Velvety Organic Sphere (favorite)
  float shapeFav =
    sin(ang * 2.0 - u_coreSpin * 1.1) * (0.007 + u_bass * 0.022) +
    cos(ang * 3.0 + u_flowPhase * 0.65) * (0.004 + u_mid * 0.016);

  // Silhouette 2: 5-Fold Astral Prism (discover)
  float prismAngle = ang * 5.0 - u_coreSpin * 1.5;
  float shapeDisc =
    cos(prismAngle) * (0.032 + u_mid * 0.042 + u_subBass * 0.022 + u_kick * 0.014) +
    cos(prismAngle * 2.0) * (0.007 + u_treble * 0.016);

  // Silhouette 3: 8-Crest Kinetic Ferrofluid Crown (popular)
  float crownAngle = ang * 8.0 - u_coreSpin * 1.65;
  float crownWave = pow(0.5 + 0.5 * cos(crownAngle), 1.85) - 0.36;
  float shapePop =
    crownWave * (0.034 + u_bass * 0.048 + u_subBass * 0.034 + u_mid * 0.022 + u_kick * 0.018) +
    sin(ang * 4.0 - u_coreSpin * 1.2) * (0.008 + u_mid * 0.022);

  float characterMorph =
    u_shapeWeights.x * shapeFav +
    u_shapeWeights.y * shapeDisc +
    u_shapeWeights.z * shapePop;

  // 3) Smooth 16-band fluid contour harmonics (zero-mean + angular simplex noise -> no flat circular sectors)
  float symA = abs(fract((ang - u_coreSpin * 0.42) / 6.2831853 + 0.5) * 2.0 - 1.0);
  float specLow  = sampleBand(symA * 0.36);
  float specMid  = sampleBand(0.20 + symA * 0.52);
  float specHigh = sampleBand(0.54 + symA * 0.46);

  float angNoise = snoise(vec3(cos(ang) * 1.45, sin(ang) * 1.45, u_flowPhase * 0.28));

  float fluidLow = specLow * (
    0.044 * cos(ang * 2.0 - u_coreSpin * 1.05 + u_flowPhase * 0.35) +
    0.026 * sin(ang * 3.0 + u_flowPhase * 0.55) +
    0.024 * angNoise
  );
  float fluidMid = specMid * (
    0.046 * sin(ang * 3.0 - u_flowPhase * 1.15 + specLow * 1.35) +
    0.026 * cos(ang * 4.0 + u_flowPhase * 0.85) +
    0.016 * angNoise
  );
  float fluidHigh = specHigh * (
    0.024 * cos(ang * 6.0 - u_flowPhase * 1.75) +
    0.013 * sin(ang * 7.0 + u_flowPhase * 1.35)
  );

  float audioDeform = u_playBlend * (fluidLow + fluidMid + fluidHigh);

  // Gentle 2-lobe organic liquid swell from Sub-Bass (zero tremor)
  float subOrganicLobe = sin(ang * 2.0 - u_coreSpin * 1.35 + u_flowPhase * 0.45) * 0.024 * u_subBass;

  // Strictly monotonic tanh soft-knee on angular contour -> preserves lobe curvature at all peaks (asymptotic tip <= ~0.65)
  float angularDelta = idleWave + characterMorph + audioDeform + subOrganicLobe;
  float smoothDelta = 0.175 * tanh(angularDelta / 0.175);

  return max(0.24, baseR + smoothDelta);
}

vec3 shadeSphere(vec2 p, float R, out float sphereAlpha) {
  float r = length(p);
  float edgeSoftness = 0.016 + u_subBass * 0.011 + u_kick * 0.005;
  sphereAlpha = 1.0 - smoothstep(R - edgeSoftness, R + edgeSoftness, r);

  vec2 np = p / max(R, 0.001);
  float zSq = max(0.0, 1.0 - dot(np, np));
  float z = sqrt(zSq);
  vec3 N = normalize(vec3(np, z + 0.0001));

  vec3 sp = N;
  sp.xz = rot2D(u_coreSpin) * sp.xz;
  sp.yz = rot2D(0.28 + u_coreSpin * 0.35) * sp.yz;

  // Silky 3D FBM fluid currents sculpted smoothly by Mid & Sub-Bass
  vec3 drift = vec3(u_flowPhase * 0.14, -u_flowPhase * 0.08, u_flowPhase * 0.11);
  float warpAmp = 0.38 + u_playBlend * (u_mid * 0.54 + u_subBass * 0.34 + u_bass * 0.22);
  float n1 = fbmSmooth(sp * (1.55 + u_shapeWeights.y * 0.35) + drift);
  float n2 = fbmSmooth(sp * 2.25 + vec3(n1 * warpAmp) - drift * 0.65);

  float silkBand1 = smoothstep(-0.32, 0.68, sin(n2 * 3.4 + sp.y * 2.2 - u_flowPhase * 0.45));
  float silkBand2 = smoothstep(0.06, 0.88, cos(n1 * 3.0 - sp.x * 2.0 + u_flowPhase * 0.32));

  float ang = atan(p.y, p.x);
  float normR = clamp(r / max(R, 0.001), 0.0, 1.0);

  // Character-specific internal liquid-glass optical ridges
  // Discover: 5-Fold Astral Prism caustics
  float prismCaustic = u_shapeWeights.y
    * pow(0.5 + 0.5 * cos(ang * 5.0 - u_coreSpin * 1.5 + n1 * 1.5), 3.0)
    * (0.24 + u_treble * 0.55 + u_mid * 0.25);

  // Popular: Sculptural 8-Crest Ferrofluid Angular Ridges (NO concentric bullseye rings!)
  float ferroCrest = pow(0.5 + 0.5 * cos(ang * 8.0 - u_coreSpin * 1.65 + n1 * 1.25), 3.4);
  float ferroRidgeMask = smoothstep(0.24, 0.96, normR) * (0.55 + 0.45 * silkBand1);
  float popularRidge = u_shapeWeights.z * ferroCrest * ferroRidgeMask * (0.22 + u_bass * 0.36 + u_mid * 0.34 + u_subBass * 0.22);

  // Rich dark-glass bioluminescent body
  vec3 darkCore = vec3(0.044, 0.055, 0.098);
  vec3 body = mix(darkCore, u_col2 * 0.96, 0.36 + silkBand1 * 0.52);
  body = mix(body, u_col1 * 1.14, silkBand2 * (0.42 + u_mid * 0.54 + u_subBass * 0.18));

  // Treble & Mid luminous silk sheen + sculptural ridges
  float sheen = pow(clamp(silkBand1 * silkBand2, 0.0, 1.0), 1.65);
  body += u_col3 * (sheen * (0.30 + u_treble * 0.92 + u_mid * 0.38) + prismCaustic);
  body += mix(u_col1, u_col3, 0.45 + 0.35 * silkBand2) * popularRidge;

  // Smooth elastic Fresnel rim: deeper, darker, more saturated on kicks (no white washout)
  float fresnel = pow(1.0 - clamp(z, 0.0, 1.0), 2.25);
  vec3 rimColor = mix(u_col1, u_col3, 0.48 + 0.48 * sin(ang - u_coreSpin * 1.15));
  vec3 darkKickRim = mix(u_col1, u_col2, 0.28);
  body += rimColor * fresnel * (0.78 + u_subBass * 0.68 + u_mid * 0.36 + u_treble * 0.46 + u_drop * 0.24);
  body += darkKickRim * pow(fresnel, 1.55) * u_kick * 0.62;

  // Glossy liquid specular highlight responding to Mid & Treble
  vec3 lightDir = normalize(vec3(-0.45, 0.58, 0.68));
  vec3 perturbedN = normalize(N + vec3(n1, n2, 0.0) * (0.15 + u_playBlend * (u_mid * 0.22 + u_treble * 0.14 + u_subBass * 0.10)));
  float spec = pow(max(dot(perturbedN, lightDir), 0.0), 13.0);
  body += mix(vec3(0.95, 0.97, 1.0), u_col3, 0.42) * spec * (0.22 + u_treble * 0.52 + u_mid * 0.22);

  // Deep saturated sub-bass core heart (warm & weighty, never washed-out white)
  float heart = exp(-normR * normR * (4.6 - u_subBass * 1.45));
  vec3 heartCol = mix(u_col1, u_col3, 0.22 + u_subBass * 0.18);
  body += heartCol * heart * (0.09 + u_subBass * 0.44 + u_drop * 0.18 + u_kick * 0.16);

  return body;
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / max(u_resolution.y, 1.0);
  float r = length(uv);
  float ang = atan(uv.y, uv.x);

  // Deep organic chromatic rim refraction driven smoothly by Sub-Bass, Mid & Kick
  float chromaAmt = 0.0028 + u_subBass * 0.0145 + u_kick * 0.0095 + u_treble * 0.0055;
  vec2 radialDir = r > 0.0001 ? (uv / r) : vec2(0.0);

  float R0 = evalOrbRadius(uv);
  float alphaG = 0.0;
  vec3 colCenter = shadeSphere(uv, R0, alphaG);

  float rimZone = smoothstep(R0 * 0.46, R0 * 1.05, r);
  float alphaR = 0.0, alphaB = 0.0;
  vec3 colR = shadeSphere(uv - radialDir * chromaAmt * rimZone, R0, alphaR);
  vec3 colB = shadeSphere(uv + radialDir * chromaAmt * rimZone, R0, alphaB);

  vec3 orbColor = vec3(
    mix(colCenter.r, colR.r, 0.78 * rimZone),
    colCenter.g,
    mix(colCenter.b, colB.b, 0.78 * rimZone)
  );
  float orbAlpha = max(alphaG, max(alphaR, alphaB) * 0.76);

  // 1) Organic plasma wisps around the orb perimeter
  float auraEnergy = clamp(u_subBass * 0.56 + u_drop * 0.48 + u_mid * 0.34 + u_treble * 0.22 + u_kick * 0.18, 0.0, 1.40);
  vec2 auraRot = rot2D(-u_coreSpin * 0.65) * uv;
  float wisp1 = snoise(vec3(auraRot * 2.1, u_flowPhase * 0.16));
  float wisp2 = snoise(vec3(auraRot * 3.4 + vec2(4.2, -2.7), u_flowPhase * 0.22));
  float organicWarp = wisp1 * 0.095 + wisp2 * 0.045;

  float distOut = max(0.0, (r + organicWarp) - R0 * 0.87);
  float softBound = pow(clamp(1.0 - smoothstep(R0 * 0.82, 0.96, r + organicWarp * 0.55), 0.0, 1.0), 1.65);

  float glowTight = exp(-distOut * (6.6 - min(auraEnergy, 1.2) * 1.9)) * softBound;
  float glowCloud = exp(-distOut * (3.9 - min(auraEnergy, 1.2) * 1.0)) * softBound * (0.65 + 0.35 * wisp1);

  float auraAngleMix = 0.5 + 0.5 * sin(ang - u_coreSpin * 1.05 + wisp2 * 0.8);
  vec3 auraTint = mix(u_col2, u_col1, auraAngleMix);

  vec3 aura =
    auraTint * glowTight * (0.075 + auraEnergy * 0.48 + u_kick * 0.14) +
    mix(u_col2, u_col3, 0.35 + 0.25 * wisp2) * glowCloud * (0.018 + pow(auraEnergy, 1.3) * 0.28);

  // 2) Signature Anamorphic Spark ("Искра") right behind the orb core
  float dropC = clamp(u_drop, 0.0, 1.3);
  vec2 sparkAnam = uv * vec2(0.42 - min(dropC, 1.0) * 0.12, 3.4 - u_subBass * 0.55);
  float sparkStreak = exp(-dot(sparkAnam, sparkAnam) * (3.2 - min(dropC, 1.0) * 1.1));
  vec2 sparkCrossUV = uv * vec2(3.1, 0.82);
  float sparkCross = exp(-dot(sparkCrossUV, sparkCrossUV) * 4.2) * 0.45;
  vec3 sparkHue = mix(u_col1, u_col3, 0.42);
  aura += sparkHue * (sparkStreak + sparkCross) * (0.08 + u_subBass * 0.28 + dropC * 0.36 + u_treble * 0.12 + u_kick * 0.12);

  // 3) Darker, Saturated, Natural Acoustic Kick Shockwaves (shared radius with particles)
  for (int i = 0; i < 4; i++) {
    float age = u_shocks[i].x;
    float str = u_shocks[i].y;
    if (age > 0.0 && age < 1.0) {
      float prog = 1.0 - pow(1.0 - age, 2.15);
      float ringR = u_shockBaseR + prog * 0.46;
      float widthCore = 0.011 + prog * 0.025;
      float widthHalo = 0.034 + prog * 0.052;
      // Smooth organic Gaussian rise & decay
      float env = smoothstep(0.0, 0.065, age) * pow(1.0 - age, 2.2);

      float disp = 0.0036 * str * (1.0 - age * 0.45);
      float wR = exp(-pow((r - (ringR + disp)) / widthCore, 2.0));
      float wG = exp(-pow((r - ringR) / widthCore, 2.0));
      float wB = exp(-pow((r - (ringR - disp)) / widthCore, 2.0));
      float softHalo = exp(-pow((r - ringR) / widthHalo, 2.0)) * 0.28;

      float shimmer = 0.82 + 0.18 * sin(ang * 3.0 - u_coreSpin * 1.8 + prog * 4.2);
      // Deep saturated palette colors, minimal white-out (~35% darker & more natural)
      vec3 ringTint = mix(u_col2, u_col1, 0.58 - prog * 0.18);
      ringTint = mix(ringTint, u_col3, 0.22 + prog * 0.20);
      vec3 shockRGB = (vec3(wR, wG, wB) * 0.62 + vec3(softHalo)) * mix(ringTint, vec3(1.0), 0.06);
      aura += shockRGB * env * str * shimmer * 0.38;
    }
  }

  float canvasMask = 1.0 - smoothstep(0.88, 0.995, r);
  vec3 finalRGB = orbColor * orbAlpha + aura * (1.0 - orbAlpha * 0.66) * canvasMask;
  finalRGB = finalRGB / (1.0 + finalRGB * 0.22);

  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  finalRGB = max(finalRGB + dither, 0.0);

  float lumAlpha = clamp(max(finalRGB.r, max(finalRGB.g, finalRGB.b)), 0.0, 1.0);
  float finalAlpha = clamp(max(orbAlpha, lumAlpha) * canvasMask, 0.0, 1.0);

  fragColor = vec4(finalRGB * canvasMask, finalAlpha);
}`;

const PARTICLE_VERTEX_SHADER = `#version 300 es
in vec4 a_seed;
uniform vec2  u_resolution;
uniform float u_orbitPhase;
uniform float u_flowPhase;
uniform float u_sparklePhase;
uniform float u_subBass;
uniform float u_mid;
uniform float u_treble;
uniform float u_kick;
uniform float u_drop;
uniform float u_shockBaseR;
uniform vec3  u_shapeWeights;
uniform vec2  u_shocks[4];
uniform float u_dpr;

out float v_alpha;
out float v_tint;
out float v_sparkle;

void main() {
  // Continuously alive orbital motion accelerated smoothly by Mid & Treble
  float speedWeight = 0.55 + a_seed.z * 0.75;
  float angle = a_seed.x + u_orbitPhase * speedWeight;

  float fieldSpread =
    u_shapeWeights.x * 1.00 +
    u_shapeWeights.y * 1.12 +
    u_shapeWeights.z * 0.97;

  // Mid frequencies continuously drive graceful 3-lobe radial wave undulation
  float midWave = sin(angle * 3.0 - u_flowPhase * 1.35 + a_seed.w * 6.2831) * (0.014 + u_mid * 0.056);
  float midBreath = cos(u_flowPhase * 1.2 + a_seed.w * 15.7) * (0.010 + u_mid * 0.026);

  // Sub-bass & drop smoothly expand the orbital gravity field
  float gravitySwell = u_subBass * 0.072 + u_drop * 0.044;

  // Subtle natural kick push layered on top
  float kickPush = u_kick * (0.024 + 0.018 * fract(a_seed.w * 7.3));

  float rad = a_seed.y * fieldSpread + gravitySwell + midWave + midBreath + kickPush;

  // Natural passing kick shockwave impulse (shared ringR with orb shader)
  float shockExcite = 0.0;
  for (int i = 0; i < 4; i++) {
    float age = u_shocks[i].x;
    float str = u_shocks[i].y;
    if (age > 0.0 && age < 1.0) {
      float prog = 1.0 - pow(1.0 - age, 2.15);
      float ringR = u_shockBaseR + prog * 0.46;
      float hit = exp(-pow((rad - ringR) / 0.052, 2.0)) * smoothstep(0.0, 0.06, age) * pow(1.0 - age, 1.8);
      shockExcite += hit * str;
    }
  }
  rad += shockExcite * 0.036;

  // 3D inclined orbital planes
  float tilt = 0.54 + 0.38 * sin(a_seed.w * 6.2831);
  float x3d = cos(angle) * rad;
  float y3d = sin(angle) * rad * tilt;
  float z3d = sin(angle) * 0.5;

  float planeAngle = a_seed.w * 3.14159;
  float cs = cos(planeAngle), sn = sin(planeAngle);
  vec2 pos = vec2(x3d * cs - y3d * sn, x3d * sn + y3d * cs);

  pos.x /= (u_resolution.x / max(u_resolution.y, 1.0));
  gl_Position = vec4(pos, 0.0, 1.0);

  // Treble/High frequencies continuously drive crisp bioluminescent twinkling & size sparkle
  float twinkleRaw = 0.5 + 0.5 * sin(u_sparklePhase * (2.4 + a_seed.z * 2.6) + a_seed.w * 31.4);
  float trebleSparkle = pow(twinkleRaw, 2.2) * u_treble;
  float midGlow = (0.5 + 0.5 * sin(u_flowPhase * 1.9 + a_seed.w * 18.0)) * u_mid;

  float depthScale = 0.62 + 0.58 * (z3d + 0.5);
  float energy = clamp(
    midGlow * 0.62 +
    trebleSparkle * 1.15 +
    u_subBass * 0.36 +
    u_drop * 0.38 +
    shockExcite * 0.65,
    0.0, 1.5
  );

  gl_PointSize = (1.9 + a_seed.w * 2.2 + trebleSparkle * 3.1 + midGlow * 1.4 + shockExcite * 1.8) * depthScale * u_dpr;

  float edgeFade = 1.0 - smoothstep(0.75, 0.97, length(pos));
  v_alpha = (0.16 + 0.30 * twinkleRaw + energy * 0.46) * depthScale * edgeFade;
  v_tint = clamp(fract(a_seed.w * 3.7) * 0.7 + trebleSparkle * 0.45, 0.0, 1.0);
  v_sparkle = clamp(trebleSparkle * 0.85 + shockExcite * 0.35 + midGlow * 0.25, 0.0, 1.0);
}`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float v_alpha;
in float v_tint;
in float v_sparkle;
uniform vec3 u_col1;
uniform vec3 u_col2;
uniform vec3 u_col3;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float core = pow(1.0 - d, 2.8);
  float halo = pow(1.0 - d, 1.45) * 0.44;
  float glow = core + halo;
  vec3 baseCol = mix(u_col2, u_col1, v_tint);
  vec3 col = mix(baseCol, u_col3, clamp(v_tint * 0.65 + v_sparkle * 0.55, 0.0, 1.0));
  col = mix(col, vec3(1.0), clamp(0.18 * core + v_sparkle * 0.42, 0.0, 0.72));
  float a = glow * v_alpha;
  fragColor = vec4(col * a, a);
}`;

const softClip = (x: number, ceiling = 1.0): number =>
  ceiling * Math.tanh(Math.max(0, x) / ceiling);

function shapeDynamic(val: number, floor: number, gamma: number, ceiling = 1.0): number {
  const above = Math.max(0, (val - floor) / (1 - floor));
  return softClip(Math.pow(above, gamma) * 1.18, ceiling);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function resolveTargetPalette(waveSettings?: { mood?: string; activity?: string } | null): AuraPalette {
  const key =
    (waveSettings?.activity && PALETTES[waveSettings.activity] ? waveSettings.activity : null) ??
    (waveSettings?.mood && PALETTES[waveSettings.mood] ? waveSettings.mood : null) ??
    'active';
  return PALETTES[key] ?? PALETTES.active;
}

function resolveTargetShape(waveSettings?: { character?: string } | null): ShapeWeights {
  const charKey = waveSettings?.character;
  return charKey && CHARACTER_SHAPES[charKey] ? CHARACTER_SHAPES[charKey] : CHARACTER_SHAPES.favorite;
}

function compileProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[WaveVisualizerOrb] Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[WaveVisualizerOrb] Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export const WaveVisualizerOrb: React.FC<WaveVisualizerOrbProps> = ({
  onTogglePlay,
  isPlaying: propIsPlaying,
  hideCenterButton = false,
  showAmbientBackground = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { waveSettings, isPlaying: storeIsPlaying } = usePlayerStore();
  const effectiveIsPlaying = propIsPlaying ?? storeIsPlaying;

  const isPlayingRef = useRef<boolean>(effectiveIsPlaying);
  const targetPaletteRef = useRef<AuraPalette>(resolveTargetPalette(waveSettings));
  const targetShapeRef = useRef<ShapeWeights>(resolveTargetShape(waveSettings));

  useEffect(() => {
    isPlayingRef.current = effectiveIsPlaying;
  }, [effectiveIsPlaying]);

  useEffect(() => {
    targetPaletteRef.current = resolveTargetPalette(waveSettings);
  }, [waveSettings?.mood, waveSettings?.activity]);

  useEffect(() => {
    targetShapeRef.current = resolveTargetShape(waveSettings);
  }, [waveSettings?.character]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const orbProg = compileProgram(gl, QUAD_VERTEX_SHADER, ORB_FRAGMENT_SHADER);
    const particleProg = compileProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
    if (!orbProg || !particleProg) return;

    const bgCanvas = showAmbientBackground ? bgCanvasRef.current : null;
    const bgGl = bgCanvas
      ? bgCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' })
      : null;
    const bgProg = bgGl ? compileProgram(bgGl, QUAD_VERTEX_SHADER, BG_FRAGMENT_SHADER) : null;

    let bgVAO: WebGLVertexArrayObject | null = null;
    let bgBuf: WebGLBuffer | null = null;
    if (bgGl && bgProg) {
      bgVAO = bgGl.createVertexArray();
      bgBuf = bgGl.createBuffer();
      bgGl.bindVertexArray(bgVAO);
      bgGl.bindBuffer(bgGl.ARRAY_BUFFER, bgBuf);
      bgGl.bufferData(bgGl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), bgGl.STATIC_DRAW);
      const loc = bgGl.getAttribLocation(bgProg, 'a_pos');
      bgGl.enableVertexAttribArray(loc);
      bgGl.vertexAttribPointer(loc, 2, bgGl.FLOAT, false, 0, 0);
      bgGl.bindVertexArray(null);
    }

    const bgLoc = bgGl && bgProg ? {
      resolution: bgGl.getUniformLocation(bgProg, 'u_resolution'),
      orbCenter:  bgGl.getUniformLocation(bgProg, 'u_orbCenter'),
      bgPhase:    bgGl.getUniformLocation(bgProg, 'u_bgPhase'),
      subBass:    bgGl.getUniformLocation(bgProg, 'u_subBass'),
      mid:        bgGl.getUniformLocation(bgProg, 'u_mid'),
      treble:     bgGl.getUniformLocation(bgProg, 'u_treble'),
      kick:       bgGl.getUniformLocation(bgProg, 'u_kick'),
      drop:       bgGl.getUniformLocation(bgProg, 'u_drop'),
      shocks:     bgGl.getUniformLocation(bgProg, 'u_shocks[0]') || bgGl.getUniformLocation(bgProg, 'u_shocks'),
      col1:       bgGl.getUniformLocation(bgProg, 'u_col1'),
      col2:       bgGl.getUniformLocation(bgProg, 'u_col2'),
      col3:       bgGl.getUniformLocation(bgProg, 'u_col3'),
    } : null;

    const quadVAO = gl.createVertexArray();
    const quadBuf = gl.createBuffer();
    gl.bindVertexArray(quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(orbProg, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const particleVAO = gl.createVertexArray();
    const partBuf = gl.createBuffer();
    const seeds = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seeds[i * 4 + 0] = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      seeds[i * 4 + 1] = 0.45 + Math.random() * 0.34;
      seeds[i * 4 + 2] = 0.35 + Math.random() * 0.65;
      seeds[i * 4 + 3] = Math.random();
    }
    gl.bindVertexArray(particleVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const aSeed = gl.getAttribLocation(particleProg, 'a_seed');
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const orbLoc = {
      resolution:   gl.getUniformLocation(orbProg, 'u_resolution'),
      coreSpin:     gl.getUniformLocation(orbProg, 'u_coreSpin'),
      flowPhase:    gl.getUniformLocation(orbProg, 'u_flowPhase'),
      breathPhase:  gl.getUniformLocation(orbProg, 'u_breathPhase'),
      subBass:      gl.getUniformLocation(orbProg, 'u_subBass'),
      bass:         gl.getUniformLocation(orbProg, 'u_bass'),
      mid:          gl.getUniformLocation(orbProg, 'u_mid'),
      treble:       gl.getUniformLocation(orbProg, 'u_treble'),
      kick:         gl.getUniformLocation(orbProg, 'u_kick'),
      drop:         gl.getUniformLocation(orbProg, 'u_drop'),
      playBlend:    gl.getUniformLocation(orbProg, 'u_playBlend'),
      shockBaseR:   gl.getUniformLocation(orbProg, 'u_shockBaseR'),
      shapeWeights: gl.getUniformLocation(orbProg, 'u_shapeWeights'),
      bands:        gl.getUniformLocation(orbProg, 'u_bands[0]') || gl.getUniformLocation(orbProg, 'u_bands'),
      shocks:       gl.getUniformLocation(orbProg, 'u_shocks[0]') || gl.getUniformLocation(orbProg, 'u_shocks'),
      col1:         gl.getUniformLocation(orbProg, 'u_col1'),
      col2:         gl.getUniformLocation(orbProg, 'u_col2'),
      col3:         gl.getUniformLocation(orbProg, 'u_col3'),
    };

    const partLoc = {
      resolution:   gl.getUniformLocation(particleProg, 'u_resolution'),
      orbitPhase:   gl.getUniformLocation(particleProg, 'u_orbitPhase'),
      flowPhase:    gl.getUniformLocation(particleProg, 'u_flowPhase'),
      sparklePhase: gl.getUniformLocation(particleProg, 'u_sparklePhase'),
      subBass:      gl.getUniformLocation(particleProg, 'u_subBass'),
      mid:          gl.getUniformLocation(particleProg, 'u_mid'),
      treble:       gl.getUniformLocation(particleProg, 'u_treble'),
      kick:         gl.getUniformLocation(particleProg, 'u_kick'),
      drop:         gl.getUniformLocation(particleProg, 'u_drop'),
      shockBaseR:   gl.getUniformLocation(particleProg, 'u_shockBaseR'),
      shapeWeights: gl.getUniformLocation(particleProg, 'u_shapeWeights'),
      shocks:       gl.getUniformLocation(particleProg, 'u_shocks[0]') || gl.getUniformLocation(particleProg, 'u_shocks'),
      dpr:          gl.getUniformLocation(particleProg, 'u_dpr'),
      col1:         gl.getUniformLocation(particleProg, 'u_col1'),
      col2:         gl.getUniformLocation(particleProg, 'u_col2'),
      col3:         gl.getUniformLocation(particleProg, 'u_col3'),
    };

    let currentDpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let orbCenterNDC: [number, number] = [0, 0];

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      currentDpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(1, Math.round(rect.width * currentDpr));
      const h = Math.max(1, Math.round(rect.height * currentDpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      const cx = (rect.left + rect.width * 0.5) / Math.max(1, window.innerWidth);
      const cy = (rect.top + rect.height * 0.5) / Math.max(1, window.innerHeight);
      orbCenterNDC = [cx * 2 - 1, 1 - cy * 2];

      if (bgGl && bgCanvas) {
        const bw = Math.max(1, Math.round(window.innerWidth));
        const bh = Math.max(1, Math.round(window.innerHeight));
        if (bgCanvas.width !== bw || bgCanvas.height !== bh) {
          bgCanvas.width = bw;
          bgCanvas.height = bh;
          bgGl.viewport(0, 0, bw, bh);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);
    handleResize();

    const onContextLost = (e: Event) => e.preventDefault();
    canvas.addEventListener('webglcontextlost', onContextLost, false);

    // DSP State
    let coreSpin = 0, flowPhase = 0, breathPhase = 0, orbitPhase = 0, sparklePhase = 0, bgPhase = 0;
    let subEnvelope = 0, smoothBass = 0, smoothMid = 0, smoothTreble = 0;
    let kickImpulse = 0, kickEnvelope = 0, dropEnergy = 0, shortEnergy = 0, longEnergy = 0;
    let playBlend = isPlayingRef.current ? 1 : 0;

    let prevLowEnergy = 0;
    let kickCooldown = 0;
    let nextShockSlot = 0;
    let histIdx = 0;
    const lowHistory = new Float32Array(HISTORY_LEN);
    const fluxHistory = new Float32Array(HISTORY_LEN);
    const shocksData = new Float32Array([-1, 0, -1, 0, -1, 0, -1, 0]);
    const smoothBands = new Float32Array(16);

    const initPal = targetPaletteRef.current;
    const curCol1: RGB = [...initPal.c1];
    const curCol2: RGB = [...initPal.c2];
    const curCol3: RGB = [...initPal.c3];
    const curShape: ShapeWeights = [...targetShapeRef.current];

    let rafId = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) * 0.001, 0.05);
      lastTime = now;

      let rawSub = 0, rawPunch = 0, rawMid = 0, rawHigh = 0;
      let targetSub = 0, targetBass = 0, targetMid = 0, targetTreble = 0;

      if (isPlayingRef.current) {
        const freqData: Uint8Array = audioVisualizer.getFrequencyData();
        const len = freqData ? freqData.length : 0;
        if (len >= 12) {
          rawSub = (
            freqData[0] * 0.42 +
            freqData[1] * 0.30 +
            freqData[2] * 0.18 +
            freqData[3] * 0.10
          ) / 255;

          let sumPunch = 0, sumMid = 0, sumHigh = 0;
          const punchEnd = Math.min(8, len);
          const midStart = Math.min(10, len);
          const midEnd = Math.min(46, len);
          const highEnd = Math.min(120, len);

          for (let i = 1; i < punchEnd; i++) sumPunch += freqData[i];
          for (let i = midStart; i < midEnd; i++) sumMid += freqData[i];
          for (let i = midEnd; i < highEnd; i++) sumHigh += freqData[i];

          rawPunch = sumPunch / (Math.max(1, punchEnd - 1) * 255);
          rawMid = sumMid / (Math.max(1, midEnd - midStart) * 255);
          rawHigh = sumHigh / (Math.max(1, highEnd - midEnd) * 255);

          // 1/f spectral rolloff compensation + asymptotic soft-knee compression (zero hard 1.0 flat-topping)
          targetSub = softClip(shapeDynamic(rawSub * SUB_GAIN, 0.24, 2.05, 1.0), 1.0);
          targetBass = softClip(shapeDynamic(rawPunch * 1.05, 0.18, 1.80, 1.0), 1.0);
          targetMid = softClip(shapeDynamic(rawMid * MID_GAIN, 0.035, 1.25, 1.0), 1.0);
          targetTreble = softClip(shapeDynamic(rawHigh * HIGH_GAIN, 0.025, 1.20, 1.0), 1.0);

          // 16 FFT bands with progressive pink-noise tilt boost + soft-knee compression
          for (let b = 0; b < 16; b++) {
            const [s, e] = BAND_RANGES[b];
            const actualS = Math.min(s, len);
            const actualE = Math.min(e, len);
            let sum = 0;
            const count = Math.max(1, actualE - actualS);
            for (let k = actualS; k < actualE; k++) sum += freqData[k];
            const tBand = b / 15;
            const tiltBoost = 1.0 + Math.pow(tBand, 1.15) * 1.45;
            const bandFloor = 0.16 - tBand * 0.125;
            const bandGamma = 1.75 - tBand * 0.52;
            const rawBand = softClip(shapeDynamic((sum / (count * 255)) * tiltBoost, bandFloor, bandGamma, 1.0), 1.0);
            const rate = rawBand > smoothBands[b] ? 20.0 : 7.5;
            smoothBands[b] += (rawBand - smoothBands[b]) * (1 - Math.exp(-dt * rate));
          }
        }
      } else {
        for (let b = 0; b < 16; b++) smoothBands[b] *= Math.exp(-dt * 7.5);
      }

      // Rolling 36-frame Flux-Only Transient Kick Detector
      kickCooldown = Math.max(0, kickCooldown - dt);
      const lowEnergy = rawSub * 0.65 + rawPunch * 0.35;
      const flux = Math.max(0, lowEnergy - prevLowEnergy);
      prevLowEnergy = lowEnergy;

      let sumLow = 0, sumFlux = 0;
      for (let i = 0; i < HISTORY_LEN; i++) {
        sumLow += lowHistory[i];
        sumFlux += fluxHistory[i];
      }
      const meanLow = sumLow / HISTORY_LEN;
      const meanFlux = sumFlux / HISTORY_LEN;
      let varFlux = 0;
      for (let i = 0; i < HISTORY_LEN; i++) {
        const d = fluxHistory[i] - meanFlux;
        varFlux += d * d;
      }
      const stdFlux = Math.sqrt(varFlux / HISTORY_LEN);

      lowHistory[histIdx] = lowEnergy;
      fluxHistory[histIdx] = flux;
      histIdx = (histIdx + 1) % HISTORY_LEN;

      if (isPlayingRef.current) {
        const fluxGate = Math.max(0.055 * KICK_GATE_MULT, meanFlux + 2.1 * KICK_GATE_MULT * stdFlux);
        if (kickCooldown <= 0 && lowEnergy > 0.36 && flux > fluxGate && lowEnergy > meanLow * 1.12) {
          const strength = Math.max(0.42, Math.min(0.95, flux * 4.2 + targetSub * 0.45));
          shocksData[nextShockSlot * 2 + 0] = 0.001;
          shocksData[nextShockSlot * 2 + 1] = strength;
          nextShockSlot = (nextShockSlot + 1) % 4;
          kickImpulse = Math.max(kickImpulse, strength);
          kickCooldown = 0.26;
        }
      }

      for (let i = 0; i < 4; i++) {
        const age = shocksData[i * 2];
        if (age > 0) {
          const nextAge = age + dt * 1.32;
          shocksData[i * 2] = nextAge >= 1.0 ? -1.0 : nextAge;
        }
      }

      // Dual-Stage Smooth-Attack / Clean-Decay Kick Envelope
      kickImpulse *= Math.exp(-dt * 12.5);
      const kickRate = kickImpulse > kickEnvelope ? 36.0 : 10.5;
      kickEnvelope += (kickImpulse - kickEnvelope) * (1 - Math.exp(-dt * kickRate));

      // Elastic Spring-Like Sub-Bass & Smooth Multi-Band Envelopes
      subEnvelope += (targetSub - subEnvelope) * (1 - Math.exp(-dt * (targetSub > subEnvelope ? 18.0 : 6.5)));
      smoothBass += (targetBass - smoothBass) * (1 - Math.exp(-dt * (targetBass > smoothBass ? 18.0 : 7.0)));
      smoothMid += (targetMid - smoothMid) * (1 - Math.exp(-dt * (targetMid > smoothMid ? 16.0 : 6.5)));
      smoothTreble += (targetTreble - smoothTreble) * (1 - Math.exp(-dt * (targetTreble > smoothTreble ? 22.0 : 8.5)));
      playBlend += ((isPlayingRef.current ? 1 : 0) - playBlend) * (1 - Math.exp(-dt * 3.8));

      // Dual-EMA Drop Energy Detector
      const instantEnergy = targetSub * 0.62 + targetBass * 0.24 + targetMid * 0.14;
      shortEnergy += (instantEnergy - shortEnergy) * (1 - Math.exp(-dt * 4.0));
      longEnergy += (instantEnergy - longEnergy) * (1 - Math.exp(-dt * 0.45));
      const energySurge = Math.max(0, Math.min(1, (shortEnergy - longEnergy) * 2.3));
      const sustainedPressure = smoothstep(0.28, 0.74, shortEnergy) * targetSub;
      const dropTarget = Math.max(0, Math.min(1.25, (sustainedPressure * 0.85 + energySurge * 0.65) * DROP_GLOW_BOOST));
      dropEnergy += (dropTarget - dropEnergy) * (1 - Math.exp(-dt * (dropTarget > dropEnergy ? 5.5 : 1.7)));

      // Smooth Palette & Character Shape Interpolation
      const targetPal = targetPaletteRef.current;
      const targetShape = targetShapeRef.current;
      const colorLerp = 1 - Math.exp(-dt * 2.8);
      const shapeLerp = 1 - Math.exp(-dt * 4.2);
      for (let i = 0; i < 3; i++) {
        curCol1[i] += (targetPal.c1[i] - curCol1[i]) * colorLerp;
        curCol2[i] += (targetPal.c2[i] - curCol2[i]) * colorLerp;
        curCol3[i] += (targetPal.c3[i] - curCol3[i]) * colorLerp;
        curShape[i] += (targetShape[i] - curShape[i]) * shapeLerp;
      }

      // Monotonic Smooth Phase Integrators
      coreSpin += dt * (0.044 + playBlend * 0.032 + smoothMid * 0.068);
      flowPhase += dt * (0.12 + playBlend * 0.14 + smoothMid * 0.36 + smoothBass * 0.12);
      breathPhase += dt * (0.72 + playBlend * 0.16);
      orbitPhase += dt * (0.11 + playBlend * 0.09 + smoothMid * 0.42 + smoothTreble * 0.16);
      sparklePhase += dt * (0.90 + smoothTreble * 2.8 + smoothMid * 0.7);
      bgPhase += dt * (0.20 + playBlend * 0.12 + dropEnergy * 0.16 + smoothMid * 0.12);

      const shockBaseR = 0.365 + 0.115 * Math.tanh((subEnvelope * 0.078 + dropEnergy * 0.022) / 0.115);

      if (bgGl && bgProg && bgLoc && bgVAO) {
        bgGl.useProgram(bgProg);
        bgGl.bindVertexArray(bgVAO);
        bgGl.uniform2f(bgLoc.resolution, bgCanvas!.width, bgCanvas!.height);
        bgGl.uniform2f(bgLoc.orbCenter, orbCenterNDC[0], orbCenterNDC[1]);
        bgGl.uniform1f(bgLoc.bgPhase, bgPhase);
        bgGl.uniform1f(bgLoc.subBass, subEnvelope);
        bgGl.uniform1f(bgLoc.mid, smoothMid);
        bgGl.uniform1f(bgLoc.treble, smoothTreble);
        bgGl.uniform1f(bgLoc.kick, kickEnvelope);
        bgGl.uniform1f(bgLoc.drop, dropEnergy);
        if (bgLoc.shocks) bgGl.uniform2fv(bgLoc.shocks, shocksData);
        bgGl.uniform3fv(bgLoc.col1, curCol1);
        bgGl.uniform3fv(bgLoc.col2, curCol2);
        bgGl.uniform3fv(bgLoc.col3, curCol3);
        bgGl.drawArrays(bgGl.TRIANGLES, 0, 6);
        bgGl.bindVertexArray(null);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      // Pass 1: Velvety Morphing Core + Anamorphic Spark + Organic Shockwaves
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(orbProg);
      gl.bindVertexArray(quadVAO);
      gl.uniform2f(orbLoc.resolution, canvas.width, canvas.height);
      gl.uniform1f(orbLoc.coreSpin, coreSpin);
      gl.uniform1f(orbLoc.flowPhase, flowPhase);
      gl.uniform1f(orbLoc.breathPhase, breathPhase);
      gl.uniform1f(orbLoc.subBass, subEnvelope);
      gl.uniform1f(orbLoc.bass, smoothBass);
      gl.uniform1f(orbLoc.mid, smoothMid);
      gl.uniform1f(orbLoc.treble, smoothTreble);
      gl.uniform1f(orbLoc.kick, kickEnvelope);
      gl.uniform1f(orbLoc.drop, dropEnergy);
      gl.uniform1f(orbLoc.playBlend, playBlend);
      gl.uniform1f(orbLoc.shockBaseR, shockBaseR);
      gl.uniform3fv(orbLoc.shapeWeights, curShape);
      if (orbLoc.bands) gl.uniform1fv(orbLoc.bands, smoothBands);
      if (orbLoc.shocks) gl.uniform2fv(orbLoc.shocks, shocksData);
      gl.uniform3fv(orbLoc.col1, curCol1);
      gl.uniform3fv(orbLoc.col2, curCol2);
      gl.uniform3fv(orbLoc.col3, curCol3);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Pass 2: 140 Continuously Alive Multi-Band Orbital Particles
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(particleProg);
      gl.bindVertexArray(particleVAO);
      gl.uniform2f(partLoc.resolution, canvas.width, canvas.height);
      gl.uniform1f(partLoc.orbitPhase, orbitPhase);
      gl.uniform1f(partLoc.flowPhase, flowPhase);
      gl.uniform1f(partLoc.sparklePhase, sparklePhase);
      gl.uniform1f(partLoc.subBass, subEnvelope);
      gl.uniform1f(partLoc.mid, smoothMid);
      gl.uniform1f(partLoc.treble, smoothTreble);
      gl.uniform1f(partLoc.kick, kickEnvelope);
      gl.uniform1f(partLoc.drop, dropEnergy);
      gl.uniform1f(partLoc.shockBaseR, shockBaseR);
      gl.uniform3fv(partLoc.shapeWeights, curShape);
      if (partLoc.shocks) gl.uniform2fv(partLoc.shocks, shocksData);
      gl.uniform1f(partLoc.dpr, currentDpr);
      gl.uniform3fv(partLoc.col1, curCol1);
      gl.uniform3fv(partLoc.col2, curCol2);
      gl.uniform3fv(partLoc.col3, curCol3);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
      gl.bindVertexArray(null);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.deleteBuffer(quadBuf);
      gl.deleteBuffer(partBuf);
      gl.deleteVertexArray(quadVAO);
      gl.deleteVertexArray(particleVAO);
      gl.deleteProgram(orbProg);
      gl.deleteProgram(particleProg);
      if (bgGl) {
        if (bgBuf) bgGl.deleteBuffer(bgBuf);
        if (bgVAO) bgGl.deleteVertexArray(bgVAO);
        if (bgProg) bgGl.deleteProgram(bgProg);
      }
    };
  }, [showAmbientBackground]);

  return (
    <>
      {showAmbientBackground && (
        <canvas
          ref={bgCanvasRef}
          className="fixed inset-0 w-full h-full pointer-events-none z-0"
          aria-hidden="true"
        />
      )}

      <div
        ref={containerRef}
        className={`relative w-full aspect-square max-w-[420px] sm:max-w-[460px] flex items-center justify-center select-none mx-auto overflow-visible ${
          hideCenterButton ? 'cursor-pointer' : ''
        } ${className || ''}`}
        onClick={hideCenterButton ? onTogglePlay : undefined}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block pointer-events-none z-[2]"
          aria-hidden="true"
        />

        {!hideCenterButton && (
          <div className="relative z-10 flex items-center justify-center">
            <span
              className={`absolute -inset-1.5 rounded-full border border-white/25 pointer-events-none transition-opacity duration-500 ${
                effectiveIsPlaying ? 'opacity-100 animate-pulse' : 'opacity-0'
              }`}
            />
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={effectiveIsPlaying ? 'Пауза' : 'Воспроизвести Мою Волну'}
              className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer outline-none
                bg-[#10131C]/40 backdrop-blur-xl border border-white/20
                shadow-[0_12px_36px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.28)]
                transition-all duration-200 ease-out
                hover:scale-105 hover:border-white/35 active:scale-95
                focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <svg
                className={`w-6 h-6 ml-0.5 text-white transition-all duration-300 ease-out absolute ${
                  effectiveIsPlaying ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                }`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7.5 5.25c0-.86.94-1.39 1.68-.95l10.5 6.25a1.1 1.1 0 010 1.9l-10.5 6.25c-.74.44-1.68-.09-1.68-.95V5.25z" />
              </svg>
              <svg
                className={`w-6 h-6 text-white transition-all duration-300 ease-out absolute ${
                  effectiveIsPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                }`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6.5" y="5" width="3.8" height="14" rx="1.6" />
                <rect x="13.7" y="5" width="3.8" height="14" rx="1.6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default WaveVisualizerOrb;
