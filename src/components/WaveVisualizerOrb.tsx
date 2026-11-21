import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { audioVisualizer } from '../utils/audioVisualizer';

interface WaveVisualizerOrbProps {
  onTogglePlay: () => void;
  isPlaying: boolean;
}

export function WaveVisualizerOrb({ onTogglePlay, isPlaying }: WaveVisualizerOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeMoodHue, setActiveMoodHue] = useState<number>(0);
  const { waveSettings } = usePlayerStore();

  // Dynamic hue depending on mood chip
  useEffect(() => {
    if (waveSettings?.mood === 'active') setActiveMoodHue(10); // Red-Orange neon
    else if (waveSettings?.activity === 'driving') setActiveMoodHue(280); // Purple-Violet
    else if (waveSettings?.activity === 'work-background') setActiveMoodHue(190); // Cyan-Blue
    else if (waveSettings?.character === 'discover') setActiveMoodHue(145); // Emerald-Green
    else if (waveSettings?.character === 'favorite') setActiveMoodHue(340); // Vivid Crimson
    else setActiveMoodHue(0);
  }, [waveSettings]);

  // Live Canvas Waveform & Organic Liquid Orb
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = 68;

      ctx.clearRect(0, 0, w, h);

      // Get real audio frequency data if playing
      const freq = isPlaying ? audioVisualizer.getFrequencyData() : [];
      let bassAvg = 0;
      if (freq.length > 0) {
        for (let i = 0; i < 8; i++) {
          bassAvg += freq[i] || 0;
        }
        bassAvg = bassAvg / (8 * 255);
      }

      phase += isPlaying ? 0.035 + bassAvg * 0.05 : 0.015;

      // 1. Concentric Breathing Ripples
      const rippleCount = 3;
      for (let r = 1; r <= rippleCount; r++) {
        const ripplePhase = (phase * 0.8 + r * 1.8) % (Math.PI * 2);
        const rippleScale = 1 + Math.sin(ripplePhase) * 0.18 + (isPlaying ? bassAvg * 0.25 : 0);
        const radius = baseRadius * (1.1 + r * 0.22) * rippleScale;
        const alpha = Math.max(0, 0.28 - r * 0.08 + (isPlaying ? bassAvg * 0.2 : 0));

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${345 + activeMoodHue}, 95%, 62%, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 8]);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Organic Morphed Liquid Acoustic Mesh
      const numPoints = 64;
      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const freqIdx = Math.floor((i / numPoints) * Math.min(freq.length || 32, 32));
        const audioAmp = freq.length > 0 ? (freq[freqIdx] || 0) / 255 : 0;

        // Multi-frequency wave oscillation
        const wave1 = Math.sin(angle * 4 + phase * 2) * 5;
        const wave2 = Math.cos(angle * 7 - phase * 1.5) * 4;
        const wave3 = Math.sin(angle * 12 + phase * 3) * (isPlaying ? 6 * audioAmp + 2 : 2);

        const r = baseRadius + wave1 + wave2 + wave3 + (isPlaying ? bassAvg * 14 : 0);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Fluid Gradient inside Orb
      const grad = ctx.createRadialGradient(
        cx - 20,
        cy - 20,
        10,
        cx,
        cy,
        baseRadius * 1.25
      );
      grad.addColorStop(0, `hsla(${350 + activeMoodHue}, 100%, 65%, 0.95)`);
      grad.addColorStop(0.4, `hsla(${340 + activeMoodHue}, 90%, 48%, 0.85)`);
      grad.addColorStop(0.75, `hsla(${270 + activeMoodHue}, 75%, 25%, 0.65)`);
      grad.addColorStop(1, 'rgba(16, 19, 28, 0.4)');

      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing Neon Rim
      ctx.strokeStyle = `hsla(${350 + activeMoodHue}, 100%, 75%, ${isPlaying ? 0.9 : 0.6})`;
      ctx.lineWidth = isPlaying ? 2.5 : 1.5;
      ctx.shadowColor = `hsla(${350 + activeMoodHue}, 100%, 60%, 0.8)`;
      ctx.shadowBlur = isPlaying ? 20 : 10;
      ctx.stroke();
      ctx.restore();

      // 3. Audio Frequency Orbit Pins (Sound Aura)
      if (isPlaying) {
        ctx.save();
        const pinCount = 36;
        for (let p = 0; p < pinCount; p++) {
          const pinAngle = (p / pinCount) * Math.PI * 2 + phase * 0.5;
          const pinFreqIdx = p * 2;
          const pinAmp = freq.length > 0 ? (freq[pinFreqIdx % freq.length] || 0) / 255 : 0;
          const pinLen = 4 + pinAmp * 18;

          const startR = baseRadius * 1.05;
          const endR = startR + pinLen;

          const x1 = cx + Math.cos(pinAngle) * startR;
          const y1 = cy + Math.sin(pinAngle) * startR;
          const x2 = cx + Math.cos(pinAngle) * endR;
          const y2 = cy + Math.sin(pinAngle) * endR;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `hsla(${350 + activeMoodHue + p * 2}, 95%, 70%, ${0.3 + pinAmp * 0.7})`;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, activeMoodHue]);

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Dynamic Ambient Background Glow */}
      <div
        className="pointer-events-none absolute w-72 h-72 rounded-full opacity-25 blur-3xl transition-all duration-700"
        style={{
          backgroundColor: `hsl(${350 + activeMoodHue}, 100%, 60%)`,
          transform: isPlaying ? 'scale(1.15)' : 'scale(1)',
        }}
      />

      {/* Canvas Organic Visualizer */}
      <div className="relative w-52 h-52 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Central Ergonomic Control Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Пауза' : 'Запустить Мою Волну'}
          className="relative z-10 w-16 h-16 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all duration-150 border border-white/20 group"
        >
          {isPlaying ? (
            <Pause size={28} fill="currentColor" className="transition-transform group-hover:scale-110" />
          ) : (
            <Play size={28} fill="currentColor" className="ml-1 transition-transform group-hover:scale-110" />
          )}
        </button>
      </div>
    </div>
  );
}
export default WaveVisualizerOrb;
