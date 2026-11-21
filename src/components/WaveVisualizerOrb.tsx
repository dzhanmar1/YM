import React, { useEffect, useRef } from 'react';
import { audioVisualizer } from '../utils/audioVisualizer';
import { usePlayerStore } from '../store/playerStore';

export interface WaveVisualizerOrbProps {
  onTogglePlay: () => void;
  isPlaying: boolean;
}

type RGB = [number, number, number];

interface AuraPalette {
  c1: RGB; // Primary neon accent
  c2: RGB; // Secondary nebula body
  c3: RGB; // Luminous highlight / diffraction tint
}

const PALETTES: Record<string, AuraPalette> = {
  // Moods
  active:            { c1: [1.00, 0.23, 0.36], c2: [0.47, 0.16, 0.79], c3: [1.00, 0.42, 0.21] },
  fun:               { c1: [1.00, 0.30, 0.48], c2: [1.00, 0.62, 0.17], c3: [0.78, 0.22, 0.84] },
  calm:              { c1: [0.00, 0.44, 0.95], c2: [0.00, 0.96, 0.83], c3: [0.28, 0.22, 0.82] },
  sad:               { c1: [0.22, 0.36, 0.92], c2: [0.45, 0.22, 0.88], c3: [0.38, 0.72, 0.98] },
  // Activities
  driving:           { c1: [1.00, 0.18, 0.38], c2: [0.47, 0.16, 0.79], c3: [0.00, 0.83, 1.00] },
  'work-background': { c1: [0.12, 0.38, 1.00], c2: [0.00, 0.96, 0.83], c3: [0.43, 0.36, 0.96] },
  workout:           { c1: [1.00, 0.23, 0.36], c2: [1.00, 0.42, 0.21], c3: [1.00, 0.12, 0.54] },
  'wake-up':         { c1: [1.00, 0.48, 0.24], c2: [1.00, 0.29, 0.49], c3: [1.00, 0.82, 0.40] },
  'fall-asleep':     { c1: [0.24, 0.20, 0.68], c2: [0.38, 0.14, 0.74], c3: [0.22, 0.74, 0.97] },
};

const CHARACTER_TINTS: Record<string, RGB> = {
  favorite: [1.00, 0.23, 0.36], // Aura Coral
  discover: [0.00, 0.96, 0.83], // Cyber Teal
  popular:  [0.88, 0.25, 0.98], // Electric Magenta
};

const PARTICLE_COUNT = 84;

const ORB_VERTEX_SHADER = `#version 300 es
  in vec2 a_pos;
  out vec2 v_uv;
  void main() {
    v_uv = a_pos;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const ORB_FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in vec2 v_uv;
  out vec4 fragColor;

  uniform vec2  u_resolution;
  uniform float u_flowPhase;
  uniform float u_breathPhase;
  uniform float u_ripplePhase;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treble;
  uniform float u_playBlend;
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

  float evalOrbRadius(vec2 p) {
    float ang = atan(p.y, p.x);
    float breathe = sin(u_breathPhase) * 0.018;
    float h2 = sin(ang * 2.0 - u_flowPhase * 1.15) * (0.012 + u_bass * 0.024);
    float h3 = sin(ang * 3.0 - u_flowPhase * 1.65 + 1.2) * (0.008 + u_mid * 0.018);
    float h4 = cos(ang * 4.0 - u_flowPhase * 0.90) * (0.004 + u_treble * 0.011);
    return 0.46 + breathe + u_bass * 0.055 + h2 + h3 + h4;
  }

  vec3 shadeSphere(vec2 p, float R, out float sphereAlpha) {
    float r = length(p);
    float edgeSoftness = 0.022 + u_bass * 0.012;
    sphereAlpha = 1.0 - smoothstep(R - edgeSoftness, R + edgeSoftness, r);

    vec2 np = p / max(R, 0.001);
    float zSq = max(0.0, 1.0 - dot(np, np));
    float z = sqrt(zSq);
    vec3 N = normalize(vec3(np, z + 0.0001));

    vec3 sp = N;
    sp.xz = rot2D(u_flowPhase * 0.42) * sp.xz;
    sp.yz = rot2D(0.32 + u_flowPhase * 0.14) * sp.yz;

    vec3 drift = vec3(u_flowPhase * 0.22, -u_flowPhase * 0.12, u_flowPhase * 0.16);
    float n1 = fbmSmooth(sp * 1.65 + drift);
    float n2 = fbmSmooth(sp * 2.35 + vec3(n1 * 0.55) - drift * 0.7);

    float silkBand1 = smoothstep(-0.35, 0.65, sin(n2 * 3.4 + sp.y * 2.2 - u_flowPhase * 0.65));
    float silkBand2 = smoothstep(0.10, 0.92, cos(n1 * 3.0 - sp.x * 2.0 + u_flowPhase * 0.45));

    vec3 darkCore = vec3(0.055, 0.068, 0.115);
    vec3 body = mix(darkCore, u_col2 * 0.92, 0.38 + silkBand1 * 0.52);
    body = mix(body, u_col1 * 1.15, silkBand2 * (0.48 + u_mid * 0.34));

    float sheen = pow(clamp(silkBand1 * silkBand2, 0.0, 1.0), 1.8);
    body += u_col3 * sheen * (0.42 + u_treble * 0.68 + u_bass * 0.25);

    float fresnel = pow(1.0 - clamp(z, 0.0, 1.0), 2.35);
    vec3 rimColor = mix(u_col1, u_col3, 0.5 + 0.5 * sin(atan(p.y, p.x) - u_flowPhase * 0.7));
    body += rimColor * fresnel * (0.95 + u_bass * 0.65 + u_treble * 0.35);

    vec3 lightDir = normalize(vec3(-0.45, 0.58, 0.68));
    vec3 perturbedN = normalize(N + vec3(n1, n2, 0.0) * 0.16);
    float spec = pow(max(dot(perturbedN, lightDir), 0.0), 14.0);
    body += mix(vec3(1.0), u_col3, 0.35) * spec * (0.28 + u_treble * 0.22);

    float heart = exp(-r * r * 14.0);
    body += mix(u_col1, vec3(1.0, 0.92, 0.96), 0.35) * heart * (0.14 + u_bass * 0.34);

    return body;
  }

  void main() {
    vec2 uv = v_uv;
    uv.x *= u_resolution.x / max(u_resolution.y, 1.0);
    float r = length(uv);

    float chromaAmt = 0.004 + u_bass * 0.011 + u_treble * 0.006;
    vec2 radialDir = r > 0.0001 ? (uv / r) : vec2(0.0);

    float R0 = evalOrbRadius(uv);
    float alphaG = 0.0;
    vec3 colCenter = shadeSphere(uv, R0, alphaG);

    float rimZone = smoothstep(R0 * 0.55, R0 * 1.02, r);
    float alphaR = 0.0, alphaB = 0.0;
    vec3 colR = shadeSphere(uv - radialDir * chromaAmt * rimZone, R0, alphaR);
    vec3 colB = shadeSphere(uv + radialDir * chromaAmt * rimZone, R0, alphaB);

    vec3 orbColor = vec3(
      mix(colCenter.r, colR.r, 0.65 * rimZone),
      colCenter.g,
      mix(colCenter.b, colB.b, 0.65 * rimZone)
    );
    float orbAlpha = max(alphaG, max(alphaR, alphaB) * 0.72);

    float distOut = max(0.0, r - R0 * 0.85);
    float glowInner = exp(-distOut * (4.2 - u_bass * 1.1));
    float glowOuter = exp(-distOut * (2.1 - u_bass * 0.35));
    float ang = atan(uv.y, uv.x);
    float auraAngleMix = 0.5 + 0.5 * sin(ang - u_flowPhase * 0.55);
    vec3 auraTint = mix(u_col2, u_col1, auraAngleMix);
    auraTint = mix(auraTint, u_col3, 0.22 * (0.5 + 0.5 * cos(ang * 2.0 - u_flowPhase * 0.4)));

    vec3 aura = auraTint * (glowInner * (0.48 + u_bass * 0.38) + glowOuter * (0.20 + u_mid * 0.16));

    float wave1 = fract(u_ripplePhase * 0.32);
    float wave2 = fract(u_ripplePhase * 0.32 + 0.5);
    float ringRadius1 = R0 + wave1 * 0.44;
    float ringRadius2 = R0 + wave2 * 0.44;
    float ringWidth = 0.012 + u_bass * 0.010;
    float ring1 = exp(-pow((r - ringRadius1) / ringWidth, 2.0)) * (1.0 - wave1) * smoothstep(0.0, 0.12, wave1);
    float ring2 = exp(-pow((r - ringRadius2) / ringWidth, 2.0)) * (1.0 - wave2) * smoothstep(0.0, 0.12, wave2);

    float ringIntensity = (0.06 + u_playBlend * 0.18 + u_bass * 0.32);
    vec3 ringCol = mix(u_col1, u_col3, 0.55) * ring1 + mix(u_col2, u_col3, 0.45) * ring2;
    aura += ringCol * ringIntensity;

    float canvasMask = 1.0 - smoothstep(0.76, 0.995, r);
    vec3 finalRGB = orbColor * orbAlpha + aura * (1.0 - orbAlpha * 0.62) * canvasMask;
    finalRGB = finalRGB / (1.0 + finalRGB * 0.22);

    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    finalRGB = max(finalRGB + dither, 0.0);

    float lumAlpha = clamp(max(finalRGB.r, max(finalRGB.g, finalRGB.b)) * 1.35, 0.0, 1.0);
    float finalAlpha = clamp(max(orbAlpha, lumAlpha) * canvasMask, 0.0, 1.0);

    fragColor = vec4(finalRGB * canvasMask, finalAlpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `#version 300 es
  in vec4 a_seed;
  uniform vec2  u_resolution;
  uniform float u_orbitPhase;
  uniform float u_bass;
  uniform float u_treble;
  uniform float u_dpr;

  out float v_alpha;
  out float v_tint;

  void main() {
    float angle = a_seed.x + u_orbitPhase * a_seed.z;
    float tilt = 0.55 + 0.35 * sin(a_seed.w * 6.2831);
    float rad = a_seed.y + u_bass * 0.055;

    float x3d = cos(angle) * rad;
    float y3d = sin(angle) * rad * tilt;
    float z3d = sin(angle) * 0.5;

    float planeAngle = a_seed.w * 3.14159;
    float cs = cos(planeAngle), sn = sin(planeAngle);
    vec2 pos = vec2(x3d * cs - y3d * sn, x3d * sn + y3d * cs);

    pos.x /= (u_resolution.x / max(u_resolution.y, 1.0));
    gl_Position = vec4(pos, 0.0, 1.0);

    float twinkle = 0.45 + 0.55 * sin(u_orbitPhase * 4.0 + a_seed.w * 25.0);
    float depthScale = 0.65 + 0.55 * (z3d + 0.5);
    gl_PointSize = (1.8 + a_seed.w * 2.6 + u_treble * 2.2) * depthScale * u_dpr;

    float edgeFade = 1.0 - smoothstep(0.74, 0.96, length(pos));
    v_alpha = (0.14 + 0.42 * twinkle + u_treble * 0.35) * depthScale * edgeFade;
    v_tint = fract(a_seed.w * 3.7);
  }
`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  in float v_alpha;
  in float v_tint;
  uniform vec3 u_col1;
  uniform vec3 u_col3;
  out vec4 fragColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float glow = pow(1.0 - d, 2.2);
    vec3 col = mix(u_col1, u_col3, v_tint);
    col = mix(col, vec3(1.0), 0.35 * glow);
    float a = glow * v_alpha;
    fragColor = vec4(col * a, a);
  }
`;

function resolveTargetPalette(waveSettings?: {
  mood?: string;
  activity?: string;
  character?: string;
} | null): AuraPalette {
  const key =
    (waveSettings?.activity && PALETTES[waveSettings.activity] ? waveSettings.activity : null) ??
    (waveSettings?.mood && PALETTES[waveSettings.mood] ? waveSettings.mood : null) ??
    'active';

  const base = PALETTES[key] ?? PALETTES.active;
  const tint = waveSettings?.character ? CHARACTER_TINTS[waveSettings.character] : undefined;

  if (!tint) return base;

  return {
    c1: base.c1,
    c2: base.c2,
    c3: [
      base.c3[0] * 0.78 + tint[0] * 0.22,
      base.c3[1] * 0.78 + tint[1] * 0.22,
      base.c3[2] * 0.78 + tint[2] * 0.22,
    ],
  };
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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { waveSettings, isPlaying: storeIsPlaying } = usePlayerStore();
  const effectiveIsPlaying = propIsPlaying ?? storeIsPlaying;

  // Keep reactive refs so the 60fps WebGL loop never restarts on state changes
  const isPlayingRef = useRef<boolean>(effectiveIsPlaying);
  const targetPaletteRef = useRef<AuraPalette>(resolveTargetPalette(waveSettings));

  useEffect(() => {
    isPlayingRef.current = effectiveIsPlaying;
  }, [effectiveIsPlaying]);

  useEffect(() => {
    targetPaletteRef.current = resolveTargetPalette(waveSettings);
  }, [waveSettings?.mood, waveSettings?.activity, waveSettings?.character]);

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
        phase += dt * (isPlayingRef.current ? 1.4 : 0.6);
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

    const orbProg = compileProgram(gl, ORB_VERTEX_SHADER, ORB_FRAGMENT_SHADER);
    const particleProg = compileProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
    if (!orbProg || !particleProg) return;

    // Fullscreen Quad Geometry
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

    // Orbital Micro-Stardust Geometry
    const particleVAO = gl.createVertexArray();
    const partBuf = gl.createBuffer();
    const seeds = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seeds[i * 4 + 0] = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      seeds[i * 4 + 1] = 0.52 + Math.random() * 0.32;
      seeds[i * 4 + 2] = 0.45 + Math.random() * 0.75;
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
      resolution:  gl.getUniformLocation(orbProg, 'u_resolution'),
      flowPhase:   gl.getUniformLocation(orbProg, 'u_flowPhase'),
      breathPhase: gl.getUniformLocation(orbProg, 'u_breathPhase'),
      ripplePhase: gl.getUniformLocation(orbProg, 'u_ripplePhase'),
      bass:        gl.getUniformLocation(orbProg, 'u_bass'),
      mid:         gl.getUniformLocation(orbProg, 'u_mid'),
      treble:      gl.getUniformLocation(orbProg, 'u_treble'),
      playBlend:   gl.getUniformLocation(orbProg, 'u_playBlend'),
      col1:        gl.getUniformLocation(orbProg, 'u_col1'),
      col2:        gl.getUniformLocation(orbProg, 'u_col2'),
      col3:        gl.getUniformLocation(orbProg, 'u_col3'),
    };

    const partLoc = {
      resolution: gl.getUniformLocation(particleProg, 'u_resolution'),
      orbitPhase: gl.getUniformLocation(particleProg, 'u_orbitPhase'),
      bass:       gl.getUniformLocation(particleProg, 'u_bass'),
      treble:     gl.getUniformLocation(particleProg, 'u_treble'),
      dpr:        gl.getUniformLocation(particleProg, 'u_dpr'),
      col1:       gl.getUniformLocation(particleProg, 'u_col1'),
      col3:       gl.getUniformLocation(particleProg, 'u_col3'),
    };

    // HiDPI ResizeObserver
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
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    const onContextLost = (e: Event) => e.preventDefault();
    canvas.addEventListener('webglcontextlost', onContextLost, false);

    // Monotonic Phase Integrators & Smooth Color State
    let flowPhase = 0;
    let breathPhase = 0;
    let ripplePhase = 0;
    let orbitPhase = 0;
    let smoothBass = 0;
    let smoothMid = 0;
    let smoothTreble = 0;
    let playBlend = isPlayingRef.current ? 1 : 0;

    const initPal = targetPaletteRef.current;
    const curCol1: RGB = [...initPal.c1];
    const curCol2: RGB = [...initPal.c2];
    const curCol3: RGB = [...initPal.c3];

    let rafId = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) * 0.001, 0.05);
      lastTime = now;

      let targetBass = 0;
      let targetMid = 0;
      let targetTreble = 0;

      if (isPlayingRef.current) {
        const freqData: Uint8Array = audioVisualizer.getFrequencyData();
        const len = freqData ? freqData.length : 0;
        if (len > 0) {
          let sumBass = 0;
          let sumMid = 0;
          let sumHigh = 0;
          const bEnd = Math.min(10, len);
          const mEnd = Math.min(42, len);
          const hEnd = Math.min(110, len);

          for (let i = 0; i < bEnd; i++) sumBass += freqData[i] || 0;
          for (let i = bEnd; i < mEnd; i++) sumMid += freqData[i] || 0;
          for (let i = mEnd; i < hEnd; i++) sumHigh += freqData[i] || 0;

          targetBass = Math.pow(sumBass / (Math.max(1, bEnd) * 255), 1.15);
          targetMid = Math.pow(sumMid / (Math.max(1, mEnd - bEnd) * 255), 1.05);
          targetTreble = Math.pow(sumHigh / (Math.max(1, hEnd - mEnd) * 255), 1.0);
        }
      }

      // Natural acoustic attack/release smoothing
      const bassRate = targetBass > smoothBass ? 14.0 : 5.5;
      const midRate = targetMid > smoothMid ? 8.5 : 4.0;
      const trebleRate = targetTreble > smoothTreble ? 16.0 : 6.5;

      smoothBass += (targetBass - smoothBass) * (1 - Math.exp(-dt * bassRate));
      smoothMid += (targetMid - smoothMid) * (1 - Math.exp(-dt * midRate));
      smoothTreble += (targetTreble - smoothTreble) * (1 - Math.exp(-dt * trebleRate));
      playBlend += ((isPlayingRef.current ? 1 : 0) - playBlend) * (1 - Math.exp(-dt * 3.5));

      // Smooth palette color interpolation
      const targetPal = targetPaletteRef.current;
      const colorLerp = 1 - Math.exp(-dt * 2.6);
      for (let i = 0; i < 3; i++) {
        curCol1[i] += (targetPal.c1[i] - curCol1[i]) * colorLerp;
        curCol2[i] += (targetPal.c2[i] - curCol2[i]) * colorLerp;
        curCol3[i] += (targetPal.c3[i] - curCol3[i]) * colorLerp;
      }

      // Strictly forward-advancing phases (zero back-and-forth oscillation)
      flowPhase += dt * (0.20 + playBlend * 0.22 + smoothMid * 0.42 + smoothBass * 0.18);
      breathPhase += dt * (0.72 + playBlend * 0.35);
      ripplePhase += dt * (0.35 + playBlend * 0.50 + smoothBass * 1.15);
      orbitPhase += dt * (0.14 + playBlend * 0.14 + smoothTreble * 0.28);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      // Pass 1: Bioluminescent Silk Orb + Acoustic Diffraction Aura
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(orbProg);
      gl.bindVertexArray(quadVAO);
      gl.uniform2f(orbLoc.resolution, canvas.width, canvas.height);
      gl.uniform1f(orbLoc.flowPhase, flowPhase);
      gl.uniform1f(orbLoc.breathPhase, breathPhase);
      gl.uniform1f(orbLoc.ripplePhase, ripplePhase);
      gl.uniform1f(orbLoc.bass, smoothBass);
      gl.uniform1f(orbLoc.mid, smoothMid);
      gl.uniform1f(orbLoc.treble, smoothTreble);
      gl.uniform1f(orbLoc.playBlend, playBlend);
      gl.uniform3fv(orbLoc.col1, curCol1);
      gl.uniform3fv(orbLoc.col2, curCol2);
      gl.uniform3fv(orbLoc.col3, curCol3);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Pass 2: Additive Orbital Micro-Stardust
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(particleProg);
      gl.bindVertexArray(particleVAO);
      gl.uniform2f(partLoc.resolution, canvas.width, canvas.height);
      gl.uniform1f(partLoc.orbitPhase, orbitPhase);
      gl.uniform1f(partLoc.bass, smoothBass);
      gl.uniform1f(partLoc.treble, smoothTreble);
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
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.deleteBuffer(quadBuf);
      gl.deleteBuffer(partBuf);
      gl.deleteVertexArray(quadVAO);
      gl.deleteVertexArray(particleVAO);
      gl.deleteProgram(orbProg);
      gl.deleteProgram(particleProg);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square max-w-[400px] sm:max-w-[480px] flex items-center justify-center select-none mx-auto overflow-visible"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
        aria-hidden="true"
      />

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
          className="relative w-[64px] h-[64px] rounded-full flex items-center justify-center cursor-pointer outline-none
            bg-[#10131C]/45 backdrop-blur-xl border border-white/20
            shadow-[0_12px_36px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.3)]
            transition-all duration-200 ease-out
            hover:scale-105 hover:border-white/40 active:scale-95
            focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {/* Play Icon */}
          <svg
            className={`w-6 h-6 ml-0.5 text-white transition-all duration-300 ease-out absolute ${
              effectiveIsPlaying ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7.5 5.25c0-.86.94-1.39 1.68-.95l10.5 6.25a1.1 1.1 0 010 1.9l-10.5 6.25c-.74.44-1.68-.09-1.68-.95V5.25z" />
          </svg>
          {/* Pause Icon */}
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
    </div>
  );
};

export default WaveVisualizerOrb;
