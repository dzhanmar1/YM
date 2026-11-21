import React, { useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { audioVisualizer } from '../utils/audioVisualizer';
import { usePlayerStore } from '../store/playerStore';

interface WaveVisualizerOrbProps {
  onTogglePlay: () => void;
  isPlaying: boolean;
}

// Утилиты для цветов
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : [0, 0, 0];
};

const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;
const lerpColor = (
  c1: [number, number, number],
  c2: [number, number, number],
  amt: number
): [number, number, number] => [
  lerp(c1[0], c2[0], amt),
  lerp(c1[1], c2[1], amt),
  lerp(c1[2], c2[2], amt),
];

// Палитры Яндекс Музыки (YM Aura v2) под настроения и сценарии
const MOOD_PALETTES: Record<string, string[]> = {
  active: ['#FF3B5C', '#FF6B35', '#7928CA'], // Crimson, Amber, Purple
  fun: ['#00F5D4', '#0070F3', '#FF3B5C'], // Cyber-teal, Ultramarine, Crimson
  calm: ['#0070F3', '#7928CA', '#22252E'], // Ultramarine, Purple, Dark
  sad: ['#7928CA', '#181B24', '#10131C'], // Deep Purple, Dark UI, Surface
  driving: ['#9D4EDD', '#7B2CBF', '#FF3B5C'], // Purple night drive
  'work-background': ['#00F5D4', '#00B4D8', '#181B24'], // Focus teal
  favorite: ['#FF3B5C', '#BA0035', '#7928CA'], // Favorite crimson
  discover: ['#00F5D4', '#FF3B5C', '#FF6B35'], // Discover
  workout: ['#FF3B5C', '#FF6B35', '#FFD166'], // Workout fiery
  'wake-up': ['#FFB703', '#FB8500', '#FF3B5C'], // Morning sun
  'fall-asleep': ['#3A0CA3', '#4361EE', '#10131C'], // Deep sleep
};

// --- WebGL Шейдеры ---

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Версия 5: Квантовое ядро + Флюидный фон (Dual-Layer Engine)
const fragmentShaderSource = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2 u_resolution;
  uniform float u_time;

  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treb;

  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;

  // 2D Simplex Noise
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0 * a0 + h * h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    // Нормализация координат
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    float time = u_time * 0.5;

    // ==========================================
    // СЛОЙ 1: ФОНОВАЯ ФЛЮИДНАЯ ПЛАЗМА (Окружение)
    // ==========================================
    vec2 bgUV = uv * 0.65;
    float flow = time - length(bgUV) * 1.5;

    vec2 warp = bgUV;
    warp.x += snoise(vec2(bgUV.x * 2.0 + flow, bgUV.y * 2.0)) * 0.15 * (1.0 + u_bass * 1.5);
    warp.y += snoise(vec2(bgUV.x * 2.0, bgUV.y * 2.0 - flow)) * 0.15 * (1.0 + u_bass * 1.5);

    float bgDensity = smoothstep(1.0, 0.15, length(warp)); // Плавно тает к краям

    vec3 bgColor = mix(u_color3, u_color1, snoise(warp * 2.0 + time) * 0.5 + 0.5);
    bgColor = mix(bgColor, u_color2, snoise(warp * 3.0 - time) * 0.5 + 0.5);

    // Мягкий фон, реагирующий на басы только яркостью
    vec3 bgLayer = bgColor * bgDensity * (0.25 + u_bass * 0.5);

    // ==========================================
    // СЛОЙ 2: КВАНТОВОЕ ЯДРО (Аудио-визуализатор)
    // ==========================================

    float coreRadius = 0.14 + u_bass * 0.03; // Размер стеклянной сферы

    // 2.1 ГЕОМЕТРИЯ ВОЛНЫ (Oscilloscope Rings)
    float wave = 0.0;
    // Структурные искажения от средних частот
    wave += snoise(vec2(angle * 5.0, time * 1.5)) * (u_mid * 0.08);
    // Резкая дрожь от высоких частот
    wave += snoise(vec2(angle * 14.0, time * 3.0)) * (u_treb * 0.06);
    // Экстремальные иглы-выбросы (spikes) на пиках
    float spikes = pow(abs(sin(angle * 22.0 + time * 5.0)), 30.0);
    wave += spikes * (u_treb * 0.15) * sign(snoise(vec2(angle * 3.0, time)));

    // Орбита кольца вокруг ядра
    float ringRadius = coreRadius + 0.06 + wave;
    float ringDist = abs(dist - ringRadius);

    // Рисуем кольцо (очень яркая тонкая линия + мягкое свечение)
    float ringGlow = (0.0015 + u_treb * 0.003) / (ringDist + 0.0001);
    ringGlow += smoothstep(0.05 + u_mid * 0.05, 0.0, ringDist) * 0.5;

    vec3 ringColor = mix(u_color1, u_color2, sin(angle * 2.0 - time * 2.0) * 0.5 + 0.5);
    vec3 ringLayer = ringColor * ringGlow;

    // 2.2 ВНУТРИ СФЕРЫ (Тёмное стекло + Энергетическая звезда)
    float insideGlass = smoothstep(coreRadius, coreRadius - 0.01, dist);

    // Затемняем фон за стеклом (создаем иллюзию объема)
    bgLayer *= (1.0 - insideGlass * 0.85);

    // Внутренняя пульсирующая звезда (танцует от баса)
    vec2 starPos = vec2(snoise(vec2(time * 2.0)), snoise(vec2(-time * 2.0))) * 0.02 * u_bass;
    float starDist = length(uv + starPos);
    float starGlow = (0.01 + u_bass * 0.03) / (starDist + 0.001);
    starGlow *= insideGlass; // Ограничиваем звезду стенками стекла
    vec3 starLayer = mix(u_color3, vec3(1.0), u_bass) * starGlow * 1.5;

    // 2.3 ОПТИКА КРАЁВ (Fresnel)
    // Преломление света на краях стеклянного шара
    float glassEdge = smoothstep(coreRadius - 0.02, coreRadius, dist) * smoothstep(coreRadius + 0.02, coreRadius, dist);
    vec3 edgeLayer = u_color2 * glassEdge * 3.0 * (0.5 + u_mid);

    // ==========================================
    // ФИНАЛЬНЫЙ КОМПОЗИТ
    // ==========================================
    vec3 finalColor = bgLayer + ringLayer + starLayer + edgeLayer;

    // Глубокая виньетка по краям экрана, чтобы плазма бесконечно таяла в фоне
    finalColor *= smoothstep(1.0, 0.35, length(uv));

    // Контраст (Tonemapping)
    finalColor = pow(finalColor, vec3(0.85));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const WaveVisualizerOrb: React.FC<WaveVisualizerOrbProps> = ({ onTogglePlay, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlayingRef = useRef(isPlaying);
  const { waveSettings } = usePlayerStore();

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const moodKey =
    waveSettings?.mood ||
    waveSettings?.activity ||
    waveSettings?.character ||
    'active';

  const stateRef = useRef<{
    bass: number;
    mid: number;
    treb: number;
    colors: [[number, number, number], [number, number, number], [number, number, number]];
  }>({
    bass: 0,
    mid: 0,
    treb: 0,
    colors: [
      hexToRgb('#FF3B5C'),
      hexToRgb('#FF6B35'),
      hexToRgb('#7928CA'),
    ],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true });
    if (!gl) {
      console.warn('WebGL is not supported');
      return;
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    if (!program || !vertexShader || !fragmentShader) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uBass = gl.getUniformLocation(program, 'u_bass');
    const uMid = gl.getUniformLocation(program, 'u_mid');
    const uTreb = gl.getUniformLocation(program, 'u_treb');
    const uColor1 = gl.getUniformLocation(program, 'u_color1');
    const uColor2 = gl.getUniformLocation(program, 'u_color2');
    const uColor3 = gl.getUniformLocation(program, 'u_color3');

    let animationId: number;
    const startTime = performance.now();

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uResolution, w, h);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const mathLerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const render = () => {
      const time = (performance.now() - startTime) * 0.001;
      const freqData = audioVisualizer.getFrequencyData();

      let rawBass = 0;
      let rawMid = 0;
      let rawTreb = 0;

      if (isPlayingRef.current && freqData && freqData.length > 0) {
        const bLen = Math.min(10, freqData.length);
        for (let i = 0; i < bLen; i++) rawBass += freqData[i] || 0;
        const mLen = Math.min(60, freqData.length);
        for (let i = bLen; i < mLen; i++) rawMid += freqData[i] || 0;
        const tLen = Math.min(128, freqData.length);
        for (let i = mLen; i < tLen; i++) rawTreb += freqData[i] || 0;

        rawBass = Math.pow((rawBass / Math.max(1, bLen)) / 255.0, 1.8) * 1.5;
        rawMid = Math.pow((rawMid / Math.max(1, mLen - bLen)) / 255.0, 1.2) * 1.2;
        rawTreb = Math.pow((rawTreb / Math.max(1, tLen - mLen)) / 255.0, 1.5) * 1.5;
      } else {
        // Органическое дыхание в состоянии покоя
        const breath = time * 1.5;
        rawBass = (Math.sin(breath) * 0.5 + 0.5) * 0.14;
        rawMid = (Math.cos(breath * 1.2) * 0.5 + 0.5) * 0.09;
        rawTreb = 0.05;
      }

      const st = stateRef.current;
      // Очень резкий отклик на удар (attack), плавное затухание (release)
      st.bass = rawBass > st.bass ? mathLerp(st.bass, rawBass, 0.6) : mathLerp(st.bass, rawBass, 0.08);
      st.mid = rawMid > st.mid ? mathLerp(st.mid, rawMid, 0.5) : mathLerp(st.mid, rawMid, 0.1);
      st.treb = rawTreb > st.treb ? mathLerp(st.treb, rawTreb, 0.7) : mathLerp(st.treb, rawTreb, 0.15);

      const targetPaletteHex = MOOD_PALETTES[moodKey] || MOOD_PALETTES.active;
      const targetPaletteRgb: [[number, number, number], [number, number, number], [number, number, number]] = [
        hexToRgb(targetPaletteHex[0]),
        hexToRgb(targetPaletteHex[1]),
        hexToRgb(targetPaletteHex[2]),
      ];

      st.colors[0] = lerpColor(st.colors[0], targetPaletteRgb[0], 0.05);
      st.colors[1] = lerpColor(st.colors[1], targetPaletteRgb[1], 0.05);
      st.colors[2] = lerpColor(st.colors[2], targetPaletteRgb[2], 0.05);

      gl.uniform1f(uTime, time);
      gl.uniform1f(uBass, st.bass);
      gl.uniform1f(uMid, st.mid);
      gl.uniform1f(uTreb, st.treb);

      gl.uniform3f(uColor1, st.colors[0][0], st.colors[0][1], st.colors[0][2]);
      gl.uniform3f(uColor2, st.colors[1][0], st.colors[1][1], st.colors[1][2]);
      gl.uniform3f(uColor3, st.colors[2][0], st.colors[2][1], st.colors[2][2]);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };
  }, [moodKey]);

  return (
    <div className="relative flex items-center justify-center w-full max-w-[280px] sm:max-w-[340px] aspect-square mx-auto my-1">
      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block mix-blend-screen pointer-events-none"
      />

      {/* 
        ИНВИЗИБЛ-КНОПКА НА ВЕСЬ ЭКРАН 
        Иконка полностью пропадает во время воспроизведения, оставляя ядро чистым!
      */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="absolute inset-0 z-10 w-full h-full flex items-center justify-center group outline-none cursor-pointer"
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        <div
          className={`
            flex items-center justify-center 
            w-16 h-16 rounded-full 
            bg-black/30 backdrop-blur-md 
            border border-white/10 
            shadow-[0_10px_40px_rgba(0,0,0,0.4)]
            transition-all duration-700 cubic-bezier(0.4,0,0.2,1)
            group-hover:bg-white/10 group-hover:scale-110 group-hover:border-white/30 
            group-active:scale-95 group-active:bg-white/20
            ${
              isPlaying
                ? 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-110'
                : 'opacity-100 scale-100'
            }
          `}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white fill-white/90 group-hover:fill-white transition-all" />
          ) : (
            <Play className="w-6 h-6 text-white fill-white/90 group-hover:fill-white transition-all ml-1" />
          )}
        </div>
      </button>
    </div>
  );
};
