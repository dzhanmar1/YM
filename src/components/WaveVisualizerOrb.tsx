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
const lerpColor = (c1: [number, number, number], c2: [number, number, number], amt: number): [number, number, number] => [
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
  uniform vec3 u_bg;

  // 2D Simplex Noise для органичной текучести
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
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
      m = m*m ; m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
  }

  void main() {
      // Нормализуем координаты (-1 до 1 с учетом пропорций)
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      uv *= 1.25; 
      
      float radiusDist = length(uv);
      float time = u_time * 0.5;
      
      // 1. Органическая деформация пространства (Domain Warping)
      vec2 warpUV = uv;
      warpUV.x += snoise(vec2(uv.x * 3.0 + time, uv.y * 3.0)) * 0.08 * (1.0 + u_bass * 4.0);
      warpUV.y += snoise(vec2(uv.x * 3.0, uv.y * 3.0 - time)) * 0.08 * (1.0 + u_bass * 4.0);
      
      warpUV += normalize(uv) * sin(radiusDist * 25.0 - u_time * 6.0) * 0.015 * u_mid;
      warpUV += vec2(snoise(uv * 15.0 + time), snoise(uv * 15.0 - time)) * 0.008 * u_treb;
      
      float baseR = 0.35;
      float r = length(warpUV);
      
      // 2. Иллюзия объема (3D нормали)
      float thickness = smoothstep(baseR + 0.25, 0.0, r);
      vec3 normal = normalize(vec3(warpUV.x, warpUV.y, thickness * 1.5));
      
      // 3. Внутренняя плазма (жидкий градиент)
      vec2 fluidUV = normal.xy * 2.0;
      vec2 q = vec2(snoise(fluidUV + time), snoise(fluidUV + vec2(5.2) - time));
      vec2 warp = vec2(snoise(fluidUV + q * 2.0 + u_mid * 0.5), snoise(fluidUV + q * 2.0 + vec2(8.3)));
      float fluid = snoise(fluidUV * 1.5 + warp * 3.0 - time * 1.5);
      
      // 4. Освещение и блендинг
      vec3 coreColor = mix(u_color1, u_color2, fluid * 0.5 + 0.5);
      coreColor = mix(coreColor, u_color3, warp.x * 0.5 + 0.5);
      
      float density = smoothstep(baseR + 0.15, baseR - 0.15, r);
      vec3 color = vec3(0.0);
      
      // Аура
      float aura = smoothstep(baseR + 0.8, baseR - 0.1, radiusDist);
      vec3 auraColor = mix(u_color3, u_color1, snoise(uv * 2.0 + time) * 0.5 + 0.5);
      color += auraColor * aura * 0.5 * (1.0 + u_bass * 1.8);
      
      // Тело жидкости
      vec3 fluidBody = coreColor * density;
      
      // Свечение ядра на битах
      float coreGlow = smoothstep(baseR, 0.0, r);
      fluidBody += u_color1 * pow(coreGlow, 2.5) * (u_bass * 2.5);
      
      // Хроматическая аберрация по краю
      float fresnel = 1.0 - max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
      fresnel = pow(fresnel, 2.5);
      
      vec3 rim = vec3(
          smoothstep(0.3, 0.9, fresnel + fluid * 0.15),
          smoothstep(0.4, 1.0, fresnel),
          smoothstep(0.5, 1.1, fresnel - fluid * 0.15)
      );
      fluidBody += rim * mix(u_color2, u_color3, 0.5) * density * (1.0 + u_treb * 3.0);
      
      // Блик от света
      vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
      float spec = pow(max(0.0, dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0))), 32.0);
      fluidBody += spec * vec3(1.0) * density * 0.8;
      
      color = mix(color, color + fluidBody, density);
      
      // Мягкая виньетка по краям холста
      color *= smoothstep(0.65, 0.25, radiusDist);
      color = pow(color, vec3(0.85)); 
      
      gl_FragColor = vec4(color, 1.0);
  }
`;

export const WaveVisualizerOrb: React.FC<WaveVisualizerOrbProps> = ({ onTogglePlay, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlayingRef = useRef(isPlaying);
  const { waveSettings } = usePlayerStore();

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Вычисляем ключ настроения для динамической палитры
  const moodKey =
    waveSettings?.mood ||
    waveSettings?.activity ||
    waveSettings?.character ||
    'active';

  const stateRef = useRef<{
    bass: number;
    mid: number;
    treb: number;
    colors: [ [number, number, number], [number, number, number], [number, number, number] ];
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

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported, falling back to 2D');
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

    // Quad геометрия
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uBass = gl.getUniformLocation(program, 'u_bass');
    const uMid = gl.getUniformLocation(program, 'u_mid');
    const uTreb = gl.getUniformLocation(program, 'u_treb');
    const uColor1 = gl.getUniformLocation(program, 'u_color1');
    const uColor2 = gl.getUniformLocation(program, 'u_color2');
    const uColor3 = gl.getUniformLocation(program, 'u_color3');
    const uBg = gl.getUniformLocation(program, 'u_bg');

    const bgColor = hexToRgb('#10131C');
    gl.uniform3f(uBg, bgColor[0], bgColor[1], bgColor[2]);

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

    // Render loop
    const render = () => {
      const time = (performance.now() - startTime) * 0.001;

      // 1. Извлекаем и усредняем аудиоданные
      const freqData = audioVisualizer.getFrequencyData();
      let rawBass = 0;
      let rawMid = 0;
      let rawTreb = 0;

      if (isPlayingRef.current && freqData && freqData.length > 0) {
        const bassCount = Math.min(10, freqData.length);
        for (let i = 0; i < bassCount; i++) rawBass += freqData[i] || 0;

        const midCount = Math.min(60, freqData.length);
        for (let i = bassCount; i < midCount; i++) rawMid += freqData[i] || 0;

        const trebCount = Math.min(128, freqData.length);
        for (let i = midCount; i < trebCount; i++) rawTreb += freqData[i] || 0;

        rawBass = Math.pow((rawBass / Math.max(1, bassCount)) / 255.0, 1.5) * 1.8;
        rawMid = ((rawMid / Math.max(1, midCount - bassCount)) / 255.0) * 1.2;
        rawTreb = ((rawTreb / Math.max(1, trebCount - midCount)) / 255.0) * 2.0;
      } else {
        // Органическое дыхание в состоянии покоя
        const breathTime = time * 1.8;
        rawBass = (Math.sin(breathTime) * 0.5 + 0.5) * 0.12;
        rawMid = (Math.cos(breathTime * 1.2) * 0.5 + 0.5) * 0.08;
        rawTreb = 0.04;
      }

      // 2. Fast attack / Slow release
      const st = stateRef.current;
      st.bass = rawBass > st.bass ? lerp(st.bass, rawBass, 0.4) : lerp(st.bass, rawBass, 0.06);
      st.mid = rawMid > st.mid ? lerp(st.mid, rawMid, 0.3) : lerp(st.mid, rawMid, 0.08);
      st.treb = rawTreb > st.treb ? lerp(st.treb, rawTreb, 0.5) : lerp(st.treb, rawTreb, 0.08);

      // 3. Плавный цветовой переход
      const targetPaletteHex = MOOD_PALETTES[moodKey] || MOOD_PALETTES.active;
      const targetPaletteRgb: [ [number, number, number], [number, number, number], [number, number, number] ] = [
        hexToRgb(targetPaletteHex[0]),
        hexToRgb(targetPaletteHex[1]),
        hexToRgb(targetPaletteHex[2]),
      ];

      st.colors[0] = lerpColor(st.colors[0], targetPaletteRgb[0], 0.05);
      st.colors[1] = lerpColor(st.colors[1], targetPaletteRgb[1], 0.05);
      st.colors[2] = lerpColor(st.colors[2], targetPaletteRgb[2], 0.05);

      // 4. Uniforms
      gl.uniform1f(uTime, time);
      gl.uniform1f(uBass, st.bass);
      gl.uniform1f(uMid, st.mid);
      gl.uniform1f(uTreb, st.treb);

      gl.uniform3f(uColor1, st.colors[0][0], st.colors[0][1], st.colors[0][2]);
      gl.uniform3f(uColor2, st.colors[1][0], st.colors[1][1], st.colors[1][2]);
      gl.uniform3f(uColor3, st.colors[2][0], st.colors[2][1], st.colors[2][2]);

      // 5. Отрисовка
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
      {/* WebGL Canvas с аппаратным микшированием экрана */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block mix-blend-screen pointer-events-none"
      />

      {/* Интерактивная кнопка управления поверх сферы */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="
          relative z-10 
          flex items-center justify-center 
          w-16 h-16 rounded-full 
          bg-dark-surface/60 backdrop-blur-2xl 
          border border-white/15 
          shadow-[0_10px_40px_rgba(0,0,0,0.7),inset_0_0_20px_rgba(255,255,255,0.12)]
          transition-all duration-300
          hover:scale-105 hover:border-white/30 hover:shadow-[0_10px_50px_rgba(255,59,92,0.25)]
          active:scale-95 active:bg-dark-surface/80
          group overflow-hidden
        "
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {isPlaying ? (
          <Pause className="w-6 h-6 text-white fill-white transition-all" />
        ) : (
          <Play className="w-6 h-6 text-white fill-white transition-all ml-0.5" />
        )}
      </button>
    </div>
  );
};
