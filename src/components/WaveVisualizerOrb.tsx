import React, { useEffect, useRef } from 'react';
import { audioVisualizer } from '../utils/audioVisualizer';
import { usePlayerStore } from '../store/playerStore';

export interface WaveVisualizerOrbProps {
  onTogglePlay: () => void;
  isPlaying: boolean;
  /** Hide central glass button (e.g. when play button is placed next to title) */
  hideCenterButton?: boolean;
  /** Optional: renders a full-screen deep-space aurora nebula shader behind the page */
  showAmbientBackground?: boolean;
  className?: string;
}

type RGB = [number, number, number];
type ShapeWeights = [number, number, number]; // [favorite: Sphere, discover: Prism, popular: Crown]

interface AuraPalette {
  c1: RGB; // Primary neon accent
  c2: RGB; // Secondary nebula body
  c3: RGB; // Luminous highlight / diffraction tint
}

const PALETTES: Record<string, AuraPalette> = {
  // Moods -> Color Palette
  active:            { c1: [1.00, 0.23, 0.36], c2: [0.47, 0.16, 0.79], c3: [1.00, 0.42, 0.21] },
  fun:               { c1: [1.00, 0.30, 0.48], c2: [1.00, 0.62, 0.17], c3: [0.78, 0.22, 0.84] },
  calm:              { c1: [0.00, 0.44, 0.95], c2: [0.00, 0.96, 0.83], c3: [0.28, 0.22, 0.82] },
  sad:               { c1: [0.22, 0.36, 0.92], c2: [0.45, 0.22, 0.88], c3: [0.38, 0.72, 0.98] },
  // Activities -> Color Palette
  driving:           { c1: [1.00, 0.18, 0.38], c2: [0.47, 0.16, 0.79], c3: [0.00, 0.83, 1.00] },
  'work-background': { c1: [0.12, 0.38, 1.00], c2: [0.00, 0.96, 0.83], c3: [0.43, 0.36, 0.96] },
  workout:           { c1: [1.00, 0.23, 0.36], c2: [1.00, 0.42, 0.21], c3: [1.00, 0.12, 0.54] },
  'wake-up':         { c1: [1.00, 0.48, 0.24], c2: [1.00, 0.29, 0.49], c3: [1.00, 0.82, 0.40] },
  'fall-asleep':     { c1: [0.24, 0.20, 0.68], c2: [0.38, 0.14, 0.74], c3: [0.22, 0.74, 0.97] },
};

// Character -> Core Sculptural Silhouette [Sphere, 5-Fold Prism, 8-Crest Crown]
const CHARACTER_SHAPES: Record<string, ShapeWeights> = {
  favorite: [1, 0, 0], // Velvety Organic Sphere
  discover: [0, 1, 0], // 5-Fold Astral Prism
  popular:  [0, 0, 1], // 8-Crest Kinetic Ferrofluid Crown
};

const BAND_RANGES: ReadonlyArray<[number, number]> = [
  [0, 2], [2, 4], [4, 6], [6, 9],
  [9, 13], [13, 18], [18, 24], [24, 31],
  [31, 39], [39, 48], [48, 58], [58, 69],
  [69, 81], [81, 94], [94, 108], [108, 124],
];

const PARTICLE_COUNT = 120;

const QUAD_VERTEX_SHADER = `#version 300 es
  in vec2 a_pos;
  out vec2 v_uv;
  void main() {
    v_uv = a_pos;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const BG_FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in vec2 v_uv;
  out vec4 fragColor;

  uniform vec2  u_resolution;
  uniform float u_bgPhase;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_kick;
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
    vec2 uv = v_uv;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec3 col = vec3(0.0627, 0.0745, 0.1098);
    float n1 = fbm2(p * 1.15 + vec2(u_bgPhase * 0.07, u_bgPhase * 0.04));
    float n2 = fbm2(p * 1.75 + vec2(n1 * 0.9) + vec2(-u_bgPhase * 0.05, u_bgPhase * 0.06));

    vec2 center = vec2(0.0, 0.10);
    float dist = length(p - center);

    float nebulaMask = exp(-dist * 1.25);
    vec3 cloudCol = mix(u_col2, u_col1, smoothstep(0.25, 0.78, n2));
    cloudCol = mix(cloudCol, u_col3, 0.25 * smoothstep(0.5, 0.9, n1));
    col += cloudCol * (0.075 + n2 * 0.11 + u_mid * 0.05) * nebulaMask;

    vec2 anam = (p - center) * vec2(0.55, 2.8);
    float flare = exp(-dot(anam, anam) * (2.6 - u_kick * 0.75));
    col += mix(u_col1, u_col3, 0.35) * flare * (0.07 + u_bass * 0.06 + u_kick * 0.14);

    vec2 starCell = floor((p + vec2(u_bgPhase * 0.008, 0.0)) * 34.0);
    vec2 starLocal = fract((p + vec2(u_bgPhase * 0.008, 0.0)) * 34.0) - 0.5;
    float rnd = hash21(starCell);
    if (rnd > 0.986) {
      float twinkle = 0.5 + 0.5 * sin(u_bgPhase * 2.4 + rnd * 120.0);
      float star = smoothstep(0.16, 0.0, length(starLocal)) * twinkle * 0.35;
      col += mix(vec3(0.85, 0.90, 1.0), u_col3, 0.35) * star;
    }

    col *= 1.0 - smoothstep(0.75, 2.2, dist) * 0.38;
    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    fragColor = vec4(max(col + dither, 0.0), 1.0);
  }
`;

const ORB_FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in vec2 v_uv;
  out vec4 fragColor;

  uniform vec2  u_resolution;
  uniform float u_coreSpin;
  uniform float u_flowPhase;
  uniform float u_breathPhase;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treble;
  uniform float u_kick;
  uniform float u_playBlend;
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

    float idleMask = 1.0 - u_playBlend * 0.72;
    float idleBreath = sin(u_breathPhase) * 0.018 * idleMask;
    float idleWave = (
      sin(ang * 2.0 - u_flowPhase * 0.75) * 0.011 +
      cos(ang * 3.0 - u_flowPhase * 0.55) * 0.006
    ) * idleMask;

    // Silhouette 1: Velvety Organic Sphere (favorite)
    float shapeFav = sin(ang * 2.0 - u_coreSpin * 1.2) * (0.008 + u_bass * 0.020);

    // Silhouette 2: 5-Fold Astral Prism (discover)
    float prismAngle = ang * 5.0 - u_coreSpin * 1.6;
    float shapeDisc =
      cos(prismAngle) * (0.044 + u_mid * 0.036 + u_kick * 0.022) +
      cos(prismAngle * 2.0) * (0.010 + u_treble * 0.014);

    // Silhouette 3: 8-Crest Kinetic Ferrofluid Crown (popular)
    float crownAngle = ang * 8.0 - u_coreSpin * 2.0;
    float crownWave = pow(0.5 + 0.5 * cos(crownAngle), 1.85) - 0.38;
    float shapePop =
      crownWave * (0.046 + u_bass * 0.058 + u_kick * 0.045) +
      sin(ang * 4.0 - u_coreSpin * 1.4) * (0.012 + u_mid * 0.022);

    float characterMorph =
      u_shapeWeights.x * shapeFav +
      u_shapeWeights.y * shapeDisc +
      u_shapeWeights.z * shapePop;

    float symA = abs(fract((ang - u_coreSpin * 0.5) / 6.2831853 + 0.5) * 2.0 - 1.0);
    float specLow  = sampleBand(symA * 0.45);
    float specMid  = sampleBand(0.22 + symA * 0.55);
    float specHigh = sampleBand(0.55 + symA * 0.45);

    float audioDeform = u_playBlend * (
      specLow * 0.068 +
      specMid * (0.048 * sin(ang * 3.0 - u_flowPhase * 1.3 + specLow * 2.0) + 0.036) +
      specHigh * (0.030 * cos(ang * 6.0 - u_flowPhase * 1.9))
    );

    float kickPunch = u_kick * 0.068 + u_bass * 0.052;
    return 0.435 + idleBreath + idleWave + characterMorph + audioDeform + kickPunch;
  }

  vec3 shadeSphere(vec2 p, float R, out float sphereAlpha) {
    float r = length(p);
    float edgeSoftness = 0.018 + u_bass * 0.012 + u_kick * 0.008;
    sphereAlpha = 1.0 - smoothstep(R - edgeSoftness, R + edgeSoftness, r);

    vec2 np = p / max(R, 0.001);
    float zSq = max(0.0, 1.0 - dot(np, np));
    float z = sqrt(zSq);
    vec3 N = normalize(vec3(np, z + 0.0001));

    vec3 sp = N;
    sp.xz = rot2D(u_coreSpin) * sp.xz;
    sp.yz = rot2D(0.28 + u_coreSpin * 0.35) * sp.yz;

    vec3 drift = vec3(u_flowPhase * 0.14, -u_flowPhase * 0.08, u_flowPhase * 0.11);
    float warpAmp = 0.42 + u_playBlend * (u_bass * 0.38 + u_kick * 0.28);
    float n1 = fbmSmooth(sp * (1.55 + u_shapeWeights.y * 0.35) + drift);
    float n2 = fbmSmooth(sp * 2.25 + vec3(n1 * warpAmp) - drift * 0.65);

    float silkBand1 = smoothstep(-0.32, 0.68, sin(n2 * 3.4 + sp.y * 2.2 - u_flowPhase * 0.45));
    float silkBand2 = smoothstep(0.08, 0.90, cos(n1 * 3.0 - sp.x * 2.0 + u_flowPhase * 0.32));

    float ang = atan(p.y, p.x);
    float prismCaustic = u_shapeWeights.y * pow(0.5 + 0.5 * cos(ang * 5.0 - u_coreSpin * 1.6 + n1 * 1.6), 3.0) * (0.28 + u_treble * 0.45);
    float crownPulse   = u_shapeWeights.z * smoothstep(0.2, 0.9, sin(r * 22.0 - u_flowPhase * 2.5 - u_kick * 4.0)) * (0.12 + u_bass * 0.30);

    vec3 darkCore = vec3(0.052, 0.064, 0.112);
    vec3 body = mix(darkCore, u_col2 * 0.95, 0.36 + silkBand1 * 0.54);
    body = mix(body, u_col1 * 1.18, silkBand2 * (0.46 + u_mid * 0.42));

    float sheen = pow(clamp(silkBand1 * silkBand2, 0.0, 1.0), 1.75);
    body += u_col3 * (sheen * (0.40 + u_treble * 0.72 + u_kick * 0.35) + prismCaustic + crownPulse);

    float fresnel = pow(1.0 - clamp(z, 0.0, 1.0), 2.25);
    vec3 rimColor = mix(u_col1, u_col3, 0.5 + 0.5 * sin(ang - u_coreSpin * 1.2));
    body += rimColor * fresnel * (0.95 + u_bass * 0.70 + u_kick * 0.65 + u_treble * 0.35);

    vec3 lightDir = normalize(vec3(-0.45, 0.58, 0.68));
    vec3 perturbedN = normalize(N + vec3(n1, n2, 0.0) * (0.14 + u_playBlend * (u_mid * 0.16 + u_kick * 0.14)));
    float spec = pow(max(dot(perturbedN, lightDir), 0.0), 13.0);
    body += mix(vec3(1.0), u_col3, 0.35) * spec * (0.28 + u_treble * 0.30 + u_kick * 0.20);

    float heart = exp(-r * r * 14.0);
    body += mix(u_col1, vec3(1.0, 0.92, 0.96), 0.35) * heart * (0.14 + u_bass * 0.32 + u_kick * 0.36);

    return body;
  }

  void main() {
    vec2 uv = v_uv;
    uv.x *= u_resolution.x / max(u_resolution.y, 1.0);
    float r = length(uv);

    float chromaAmt = 0.003 + u_bass * 0.009 + u_kick * 0.018 + u_treble * 0.005;
    vec2 radialDir = r > 0.0001 ? (uv / r) : vec2(0.0);

    float R0 = evalOrbRadius(uv);
    float alphaG = 0.0;
    vec3 colCenter = shadeSphere(uv, R0, alphaG);

    float rimZone = smoothstep(R0 * 0.52, R0 * 1.04, r);
    float alphaR = 0.0, alphaB = 0.0;
    vec3 colR = shadeSphere(uv - radialDir * chromaAmt * rimZone, R0, alphaR);
    vec3 colB = shadeSphere(uv + radialDir * chromaAmt * rimZone, R0, alphaB);

    vec3 orbColor = vec3(
      mix(colCenter.r, colR.r, 0.72 * rimZone),
      colCenter.g,
      mix(colCenter.b, colB.b, 0.72 * rimZone)
    );
    float orbAlpha = max(alphaG, max(alphaR, alphaB) * 0.74);

    // Volume-reactive organic aura (soft cloudy wisps, no circular boundary)
    float loudness = clamp(u_bass * 0.52 + u_mid * 0.42 + u_treble * 0.22 + u_kick * 0.48, 0.0, 1.35);

    vec2 auraRot = rot2D(-u_coreSpin * 0.7) * uv;
    float wisp1 = snoise(vec3(auraRot * 2.1, u_flowPhase * 0.16));
    float wisp2 = snoise(vec3(auraRot * 3.4 + vec2(4.2, -2.7), u_flowPhase * 0.22));
    float organicWarp = wisp1 * 0.11 + wisp2 * 0.05;

    float distOut = max(0.0, (r + organicWarp) - R0 * 0.88);
    float softBound = pow(clamp(1.0 - smoothstep(R0 * 0.85, 0.94, r + organicWarp * 0.65), 0.0, 1.0), 1.8);

    float glowTight = exp(-distOut * (6.2 - loudness * 1.6)) * softBound;
    float glowCloud = exp(-distOut * (3.6 - loudness * 0.8)) * softBound * (0.65 + 0.35 * wisp1);

    float ang = atan(uv.y, uv.x);
    float auraAngleMix = 0.5 + 0.5 * sin(ang - u_coreSpin * 1.1 + wisp2 * 0.8);
    vec3 auraTint = mix(u_col2, u_col1, auraAngleMix);

    float tightIntensity = 0.09 + loudness * 0.62 + u_kick * 0.32;
    float cloudIntensity = 0.02 + pow(loudness, 1.35) * 0.30;

    vec3 aura =
      auraTint * glowTight * tightIntensity +
      mix(u_col2, u_col3, 0.35 + 0.25 * wisp2) * glowCloud * cloudIntensity;

    // Discrete kick-only acoustic shockwaves (soft ethereal light-ripples)
    for (int i = 0; i < 4; i++) {
      float age = u_shocks[i].x;
      float str = u_shocks[i].y;
      if (age > 0.0 && age < 1.0) {
        float prog = 1.0 - pow(1.0 - age, 2.0);
        float ringR = R0 * 0.98 + prog * 0.44;
        float widthCore = 0.011 + prog * 0.028;
        float widthHalo = 0.036 + prog * 0.055;
        float env = smoothstep(0.0, 0.10, age) * pow(1.0 - age, 2.1);

        float disp = 0.0032 * str * (1.0 - age * 0.5);
        float wR = exp(-pow((r - (ringR + disp)) / widthCore, 2.0));
        float wG = exp(-pow((r - ringR) / widthCore, 2.0));
        float wB = exp(-pow((r - (ringR - disp)) / widthCore, 2.0));
        float softHalo = exp(-pow((r - ringR) / widthHalo, 2.0)) * 0.32;

        float shimmer = 0.80 + 0.20 * sin(ang * 3.0 - u_coreSpin * 2.0 + prog * 4.0);
        vec3 ringTint = mix(u_col2, u_col3, 0.35 + prog * 0.45);
        ringTint = mix(ringTint, u_col1, 0.35);
        vec3 shockRGB = (vec3(wR, wG, wB) * 0.58 + vec3(softHalo)) * mix(ringTint, vec3(1.0), 0.18);
        aura += shockRGB * env * str * shimmer * 0.46;
      }
    }

    float canvasMask = 1.0 - smoothstep(0.86, 0.995, r);
    vec3 finalRGB = orbColor * orbAlpha + aura * (1.0 - orbAlpha * 0.65) * canvasMask;
    finalRGB = finalRGB / (1.0 + finalRGB * 0.20);

    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    finalRGB = max(finalRGB + dither, 0.0);

    float lumAlpha = clamp(max(finalRGB.r, max(finalRGB.g, finalRGB.b)), 0.0, 1.0);
    float finalAlpha = clamp(max(orbAlpha, lumAlpha) * canvasMask, 0.0, 1.0);

    fragColor = vec4(finalRGB * canvasMask, finalAlpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `#version 300 es
  in vec4 a_seed;
  uniform vec2  u_resolution;
  uniform float u_orbitPhase;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treble;
  uniform float u_kick;
  uniform float u_playBlend;
  uniform vec3  u_shapeWeights;
  uniform vec2  u_shocks[4];
  uniform float u_dpr;

  out float v_alpha;
  out float v_tint;
  out float v_energy;

  void main() {
    float angle = a_seed.x + u_orbitPhase * a_seed.z;
    float fieldSpread =
      u_shapeWeights.x * 1.00 +
      u_shapeWeights.y * 1.15 +
      u_shapeWeights.z * 0.94;

    float kickPush = u_kick * (0.065 + 0.045 * fract(a_seed.w * 7.3));
    float harmonicBreath = sin(u_orbitPhase * 1.6 + a_seed.w * 12.56) * (0.015 + u_mid * 0.025);
    float rad = a_seed.y * fieldSpread + u_bass * 0.055 + kickPush + harmonicBreath;

    float shockExcite = 0.0;
    for (int i = 0; i < 4; i++) {
      float age = u_shocks[i].x;
      float str = u_shocks[i].y;
      if (age > 0.0 && age < 1.0) {
        float prog = 1.0 - pow(1.0 - age, 2.25);
        float ringR = 0.45 + prog * 0.48;
        float hit = exp(-pow((rad - ringR) / 0.055, 2.0)) * (1.0 - age);
        shockExcite += hit * str;
      }
    }
    rad += shockExcite * 0.055;

    float tilt = 0.56 + 0.36 * sin(a_seed.w * 6.2831);
    float x3d = cos(angle) * rad;
    float y3d = sin(angle) * rad * tilt;
    float z3d = sin(angle) * 0.5;

    float planeAngle = a_seed.w * 3.14159;
    float cs = cos(planeAngle), sn = sin(planeAngle);
    vec2 pos = vec2(x3d * cs - y3d * sn, x3d * sn + y3d * cs);

    pos.x /= (u_resolution.x / max(u_resolution.y, 1.0));
    gl_Position = vec4(pos, 0.0, 1.0);

    float twinkle = 0.45 + 0.55 * sin(u_orbitPhase * 3.8 + a_seed.w * 28.0);
    float depthScale = 0.62 + 0.58 * (z3d + 0.5);
    float energy = clamp(shockExcite * 1.15 + u_treble * 0.65 + u_kick * 0.45, 0.0, 1.5);

    gl_PointSize = (1.8 + a_seed.w * 2.4 + energy * 3.0) * depthScale * u_dpr;

    float edgeFade = 1.0 - smoothstep(0.75, 0.97, length(pos));
    v_alpha = (0.14 + 0.36 * twinkle + energy * 0.48) * depthScale * edgeFade;
    v_tint = fract(a_seed.w * 3.7);
    v_energy = clamp(energy, 0.0, 1.0);
  }
`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  in float v_alpha;
  in float v_tint;
  in float v_energy;
  uniform vec3 u_col1;
  uniform vec3 u_col3;
  out vec4 fragColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float core = pow(1.0 - d, 3.0);
    float halo = pow(1.0 - d, 1.5) * 0.45;
    float glow = core + halo;
    vec3 col = mix(u_col1, u_col3, v_tint);
    col = mix(col, vec3(1.0), clamp(0.28 * core + v_energy * 0.55, 0.0, 0.92));
    float a = glow * v_alpha;
    fragColor = vec4(col * a, a);
  }
`;

function resolveTargetPalette(waveSettings?: { mood?: string; activity?: string } | null): AuraPalette {
  const key =
    (waveSettings?.activity && PALETTES[waveSettings.activity] ? waveSettings.activity : null) ??
    (waveSettings?.mood && PALETTES[waveSettings.mood] ? waveSettings.mood : null) ??
    'active';
  return PALETTES[key] ?? PALETTES.active;
}

function resolveTargetShape(waveSettings?: { character?: string } | null): ShapeWeights {
  const charKey = waveSettings?.character;
  return (charKey && CHARACTER_SHAPES[charKey]) ? CHARACTER_SHAPES[charKey] : CHARACTER_SHAPES.favorite;
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

    if (!gl) {
      // Graceful Canvas 2D fallback if WebGL2 is unavailable
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let fallbackRaf = 0;
      let phase = 0;
      let last = performance.now();

      const drawFallback = (now: number) => {
        const dt = Math.min((now - last) * 0.001, 0.05);
        last = now;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(container.clientWidth * dpr));
        const h = Math.max(1, Math.round(container.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        phase += dt * (isPlayingRef.current ? 1.1 : 0.5);
        ctx.clearRect(0, 0, w, h);

        const pal = targetPaletteRef.current;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * (0.24 + Math.sin(phase) * 0.015);
        const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.9);
        grad.addColorStop(0, `rgba(${pal.c1[0] * 255}, ${pal.c1[1] * 255}, ${pal.c1[2] * 255}, 0.85)`);
        grad.addColorStop(0.5, `rgba(${pal.c2[0] * 255}, ${pal.c2[1] * 255}, ${pal.c2[2] * 255}, 0.45)`);
        grad.addColorStop(1, 'rgba(16, 19, 28, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
        ctx.fill();

        fallbackRaf = requestAnimationFrame(drawFallback);
      };

      fallbackRaf = requestAnimationFrame(drawFallback);
      return () => cancelAnimationFrame(fallbackRaf);
    }

    const orbProg = compileProgram(gl, QUAD_VERTEX_SHADER, ORB_FRAGMENT_SHADER);
    const particleProg = compileProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
    if (!orbProg || !particleProg) return;

    // Optional Full-Viewport Background Shader Context
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
      bgPhase:    bgGl.getUniformLocation(bgProg, 'u_bgPhase'),
      bass:       bgGl.getUniformLocation(bgProg, 'u_bass'),
      mid:        bgGl.getUniformLocation(bgProg, 'u_mid'),
      kick:       bgGl.getUniformLocation(bgProg, 'u_kick'),
      col1:       bgGl.getUniformLocation(bgProg, 'u_col1'),
      col2:       bgGl.getUniformLocation(bgProg, 'u_col2'),
      col3:       bgGl.getUniformLocation(bgProg, 'u_col3'),
    } : null;

    // Fullscreen Quad Geometry (Orb)
    const quadVAO = gl.createVertexArray();
    const quadBuf = gl.createBuffer();
    gl.bindVertexArray(quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(orbProg, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Gravitational Stardust Geometry
    const particleVAO = gl.createVertexArray();
    const partBuf = gl.createBuffer();
    const seeds = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seeds[i * 4 + 0] = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      seeds[i * 4 + 1] = 0.50 + Math.random() * 0.31;
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
      bass:         gl.getUniformLocation(orbProg, 'u_bass'),
      mid:          gl.getUniformLocation(orbProg, 'u_mid'),
      treble:       gl.getUniformLocation(orbProg, 'u_treble'),
      kick:         gl.getUniformLocation(orbProg, 'u_kick'),
      playBlend:    gl.getUniformLocation(orbProg, 'u_playBlend'),
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
      bass:         gl.getUniformLocation(particleProg, 'u_bass'),
      mid:          gl.getUniformLocation(particleProg, 'u_mid'),
      treble:       gl.getUniformLocation(particleProg, 'u_treble'),
      kick:         gl.getUniformLocation(particleProg, 'u_kick'),
      playBlend:    gl.getUniformLocation(particleProg, 'u_playBlend'),
      shapeWeights: gl.getUniformLocation(particleProg, 'u_shapeWeights'),
      shocks:       gl.getUniformLocation(particleProg, 'u_shocks[0]') || gl.getUniformLocation(particleProg, 'u_shocks'),
      dpr:          gl.getUniformLocation(particleProg, 'u_dpr'),
      col1:         gl.getUniformLocation(particleProg, 'u_col1'),
      col3:         gl.getUniformLocation(particleProg, 'u_col3'),
    };

    let currentDpr = Math.min(window.devicePixelRatio || 1, 2.5);
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

    // State & Audio Analysis Integrators
    let coreSpin = 0;
    let flowPhase = 0;
    let breathPhase = 0;
    let orbitPhase = 0;
    let bgPhase = 0;

    let smoothBass = 0;
    let smoothMid = 0;
    let smoothTreble = 0;
    let playBlend = isPlayingRef.current ? 1 : 0;

    let kickEnvelope = 0;
    let avgSubBass = 0;
    let prevSubBass = 0;
    let kickCooldown = 0;
    let nextShockSlot = 0;
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

      let subBass = 0;
      let targetBass = 0;
      let targetMid = 0;
      let targetTreble = 0;

      if (isPlayingRef.current) {
        const freqData: Uint8Array = audioVisualizer.getFrequencyData();
        const len = freqData ? freqData.length : 0;
        if (len > 0) {
          const subEnd = Math.min(6, len);
          const bassEnd = Math.min(12, len);
          const midEnd = Math.min(48, len);
          const highEnd = Math.min(124, len);

          let sumSub = 0, sumBass = 0, sumMid = 0, sumHigh = 0;
          for (let i = 0; i < subEnd; i++) sumSub += freqData[i];
          for (let i = 0; i < bassEnd; i++) sumBass += freqData[i];
          for (let i = bassEnd; i < midEnd; i++) sumMid += freqData[i];
          for (let i = midEnd; i < highEnd; i++) sumHigh += freqData[i];

          subBass = sumSub / (Math.max(1, subEnd) * 255);
          targetBass = Math.pow(sumBass / (Math.max(1, bassEnd) * 255), 0.92);
          targetMid = Math.pow(sumMid / (Math.max(1, midEnd - bassEnd) * 255), 0.92);
          targetTreble = Math.pow(sumHigh / (Math.max(1, highEnd - midEnd) * 255), 0.90);

          for (let b = 0; b < 16; b++) {
            const [s, e] = BAND_RANGES[b];
            const actualS = Math.min(s, len);
            const actualE = Math.min(e, len);
            let sum = 0;
            const count = Math.max(1, actualE - actualS);
            for (let k = actualS; k < actualE; k++) sum += freqData[k];
            const rawBand = Math.pow(sum / (count * 255), 0.88);
            const rate = rawBand > smoothBands[b] ? 24.0 : 8.0;
            smoothBands[b] += (rawBand - smoothBands[b]) * (1 - Math.exp(-dt * rate));
          }
        }
      } else {
        for (let b = 0; b < 16; b++) {
          smoothBands[b] *= Math.exp(-dt * 7.0);
        }
      }

      // Adaptive Kick / Bass-Peak Onset Detector
      kickCooldown = Math.max(0, kickCooldown - dt);
      const bassFlux = subBass - prevSubBass;
      prevSubBass = subBass;

      if (isPlayingRef.current) {
        const threshold = Math.max(0.30, avgSubBass * 1.22 + 0.085);
        const isPeak = (subBass > threshold && bassFlux > 0.032) || (subBass > 0.74 && bassFlux > 0.015);
        if (isPeak && kickCooldown <= 0) {
          const strength = Math.min(1.0, 0.52 + subBass * 0.58);
          shocksData[nextShockSlot * 2 + 0] = 0.001;
          shocksData[nextShockSlot * 2 + 1] = strength;
          nextShockSlot = (nextShockSlot + 1) % 4;
          kickEnvelope = Math.max(kickEnvelope, strength);
          kickCooldown = 0.23;
        }
        avgSubBass += (subBass - avgSubBass) * (1 - Math.exp(-dt * 2.6));
      } else {
        avgSubBass *= Math.exp(-dt * 4.0);
      }

      for (let i = 0; i < 4; i++) {
        const age = shocksData[i * 2];
        if (age > 0) {
          const nextAge = age + dt * 0.92;
          shocksData[i * 2] = nextAge >= 1.0 ? -1.0 : nextAge;
        }
      }
      kickEnvelope *= Math.exp(-dt * 7.8);

      const bassRate = targetBass > smoothBass ? 18.0 : 6.0;
      const midRate = targetMid > smoothMid ? 12.0 : 5.0;
      const trebleRate = targetTreble > smoothTreble ? 20.0 : 7.5;
      smoothBass += (targetBass - smoothBass) * (1 - Math.exp(-dt * bassRate));
      smoothMid += (targetMid - smoothMid) * (1 - Math.exp(-dt * midRate));
      smoothTreble += (targetTreble - smoothTreble) * (1 - Math.exp(-dt * trebleRate));
      playBlend += ((isPlayingRef.current ? 1 : 0) - playBlend) * (1 - Math.exp(-dt * 3.8));

      // Smooth Palette & Sculptural Shape Morphing (Zero recreating of WebGL program!)
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

      // Ultra-slow monotonic forward integrators (zero back-and-forth oscillation)
      coreSpin += dt * (0.042 + playBlend * 0.032 + smoothMid * 0.035);
      flowPhase += dt * (0.11 + playBlend * 0.14 + smoothMid * 0.24);
      breathPhase += dt * (0.72 + playBlend * 0.20);
      orbitPhase += dt * (0.085 + playBlend * 0.08 + smoothTreble * 0.16);
      bgPhase += dt * (0.22 + playBlend * 0.12 + smoothMid * 0.15);

      if (bgGl && bgProg && bgLoc && bgVAO) {
        bgGl.useProgram(bgProg);
        bgGl.bindVertexArray(bgVAO);
        bgGl.uniform2f(bgLoc.resolution, bgCanvas!.width, bgCanvas!.height);
        bgGl.uniform1f(bgLoc.bgPhase, bgPhase);
        bgGl.uniform1f(bgLoc.bass, smoothBass);
        bgGl.uniform1f(bgLoc.mid, smoothMid);
        bgGl.uniform1f(bgLoc.kick, kickEnvelope);
        bgGl.uniform3fv(bgLoc.col1, curCol1);
        bgGl.uniform3fv(bgLoc.col2, curCol2);
        bgGl.uniform3fv(bgLoc.col3, curCol3);
        bgGl.drawArrays(bgGl.TRIANGLES, 0, 6);
        bgGl.bindVertexArray(null);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      // Pass 1: Morphing Core + Kick Shockwaves
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(orbProg);
      gl.bindVertexArray(quadVAO);
      gl.uniform2f(orbLoc.resolution, canvas.width, canvas.height);
      gl.uniform1f(orbLoc.coreSpin, coreSpin);
      gl.uniform1f(orbLoc.flowPhase, flowPhase);
      gl.uniform1f(orbLoc.breathPhase, breathPhase);
      gl.uniform1f(orbLoc.bass, smoothBass);
      gl.uniform1f(orbLoc.mid, smoothMid);
      gl.uniform1f(orbLoc.treble, smoothTreble);
      gl.uniform1f(orbLoc.kick, kickEnvelope);
      gl.uniform1f(orbLoc.playBlend, playBlend);
      gl.uniform3fv(orbLoc.shapeWeights, curShape);
      if (orbLoc.bands) gl.uniform1fv(orbLoc.bands, smoothBands);
      if (orbLoc.shocks) gl.uniform2fv(orbLoc.shocks, shocksData);
      gl.uniform3fv(orbLoc.col1, curCol1);
      gl.uniform3fv(orbLoc.col2, curCol2);
      gl.uniform3fv(orbLoc.col3, curCol3);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Pass 2: Kick-Reactive Gravitational Orbital Stardust
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(particleProg);
      gl.bindVertexArray(particleVAO);
      gl.uniform2f(partLoc.resolution, canvas.width, canvas.height);
      gl.uniform1f(partLoc.orbitPhase, orbitPhase);
      gl.uniform1f(partLoc.bass, smoothBass);
      gl.uniform1f(partLoc.mid, smoothMid);
      gl.uniform1f(partLoc.treble, smoothTreble);
      gl.uniform1f(partLoc.kick, kickEnvelope);
      gl.uniform1f(partLoc.playBlend, playBlend);
      gl.uniform3fv(partLoc.shapeWeights, curShape);
      if (partLoc.shocks) gl.uniform2fv(partLoc.shocks, shocksData);
      gl.uniform1f(partLoc.dpr, currentDpr);
      gl.uniform3fv(partLoc.col1, curCol1);
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
  }, []);

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
        className={`relative w-full aspect-square max-w-[420px] sm:max-w-[480px] flex items-center justify-center select-none mx-auto overflow-visible ${
          hideCenterButton ? 'cursor-pointer' : ''
        } ${className || ''}`}
        onClick={hideCenterButton ? onTogglePlay : undefined}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block pointer-events-none"
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
