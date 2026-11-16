import React, { useEffect, useRef } from 'react';
import { audioVisualizer } from '../utils/audioVisualizer';
import { usePlayerStore } from '../store/playerStore';

interface AmbientBackgroundVisualizerProps {
  coverUrl?: string | null;
  accentColor?: string; // defaults to #a3021a
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AmbientBackgroundVisualizer({
  coverUrl,
  accentColor = '#a3021a',
  opacity = 0.55,
  className = '',
  style,
}: AmbientBackgroundVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Smooth energy interpolation state
  const smoothBassRef = useRef(0);
  const smoothMidRef = useRef(0);
  const smoothTrebleRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      // Use lower resolution for canvas to maximize performance with CSS blur
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(120, Math.floor(rect.width / 4));
      const h = Math.max(90, Math.floor(rect.height / 4));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Read real-time audio energy
      const energy = audioVisualizer.getEnergy(isPlaying);
      const targetBass = isPlaying ? energy.bass : 0;
      const targetMid = isPlaying ? energy.mid : 0;
      const targetTreble = isPlaying ? energy.treble : 0;

      // Exponential moving average for liquid-smooth transitions
      smoothBassRef.current += (targetBass - smoothBassRef.current) * 0.12;
      smoothMidRef.current += (targetMid - smoothMidRef.current) * 0.08;
      smoothTrebleRef.current += (targetTreble - smoothTrebleRef.current) * 0.08;

      phaseRef.current += 0.008 + smoothBassRef.current * 0.02;

      ctx.clearRect(0, 0, w, h);

      // Deep dark background
      ctx.fillStyle = '#060606';
      ctx.fillRect(0, 0, w, h);

      const bassVal = smoothBassRef.current;
      const midVal = smoothMidRef.current;
      const trebleVal = smoothTrebleRef.current;
      const t = phaseRef.current;

      // Center Blob: Primary Deep Crimson Pulse (#a3021a)
      const cx1 = w * 0.38 + Math.cos(t * 1.1) * (w * 0.12);
      const cy1 = h * 0.45 + Math.sin(t * 0.9) * (h * 0.12);
      const r1 = Math.min(w, h) * (0.35 + bassVal * 0.45);

      const grad1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.max(1, r1));
      grad1.addColorStop(0, `rgba(163, 2, 26, ${0.45 + bassVal * 0.4})`);
      grad1.addColorStop(0.5, `rgba(120, 1, 18, ${0.25 + bassVal * 0.25})`);
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.arc(cx1, cy1, r1, 0, Math.PI * 2);
      ctx.fill();

      // Right Blob: Secondary Ruby / Purple Velvet Aura
      const cx2 = w * 0.65 + Math.sin(t * 0.8) * (w * 0.15);
      const cy2 = h * 0.55 + Math.cos(t * 1.2) * (h * 0.14);
      const r2 = Math.min(w, h) * (0.3 + midVal * 0.35);

      const grad2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(1, r2));
      grad2.addColorStop(0, `rgba(180, 12, 38, ${0.35 + midVal * 0.3})`);
      grad2.addColorStop(0.6, `rgba(90, 2, 16, ${0.18 + midVal * 0.15})`);
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
      ctx.fill();

      // Top/Subtle Shimmer Blob: Treble highlight
      const cx3 = w * 0.5 + Math.cos(t * 0.6) * (w * 0.18);
      const cy3 = h * 0.3 + Math.sin(t * 0.7) * (h * 0.1);
      const r3 = Math.min(w, h) * (0.25 + trebleVal * 0.3);

      const grad3 = ctx.createRadialGradient(cx3, cy3, 0, cx3, cy3, Math.max(1, r3));
      grad3.addColorStop(0, `rgba(220, 30, 55, ${0.25 + trebleVal * 0.35})`);
      grad3.addColorStop(0.7, 'rgba(30, 0, 5, 0.08)');
      grad3.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad3;
      ctx.beginPath();
      ctx.arc(cx3, cy3, r3, 0, Math.PI * 2);
      ctx.fill();

      // Only schedule next frame if playing or still fading to silence
      if (isPlaying || bassVal > 0.005 || midVal > 0.005 || trebleVal > 0.005) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, accentColor]);

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    >
      {/* Blurred Album Cover Backdrop */}
      {coverUrl && (
        <div
          style={{
            position: 'absolute',
            inset: -40,
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(80px) saturate(1.8) brightness(0.22)',
            opacity: 0.6,
            transform: 'scale(1.15)',
          }}
        />
      )}

      {/* Reactive Fluid Ambient Light Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          filter: 'blur(64px)',
          opacity,
          mixBlendMode: 'screen',
        }}
      />

      {/* Soft Vignette Overlay to maintain contrast for text and controls */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 100%)',
        }}
      />
    </div>
  );
}
