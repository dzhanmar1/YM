import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { audioVisualizer } from '../utils/audioVisualizer';

interface DynamicTrackWaveformProps {
  trackId: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (targetTime: number) => void;
}

// Generate unique deterministic bar heights from track ID
function generateTrackWaveform(trackId: string, count = 30): number[] {
  let hash = 0;
  for (let i = 0; i < trackId.length; i++) {
    hash = (hash << 5) - hash + trackId.charCodeAt(i);
    hash |= 0;
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random based on sine and hash
    const val = Math.sin(hash + i * 1.35) * 0.5 + 0.5;
    // Map to heights between 8px and 28px with realistic musical envelope
    const envelope = Math.sin((i / (count - 1)) * Math.PI) * 0.4 + 0.6;
    const height = Math.round(8 + val * 18 * envelope);
    bars.push(Math.max(6, Math.min(28, height)));
  }
  return bars;
}

export function DynamicTrackWaveform({
  trackId,
  currentTime,
  duration,
  isPlaying,
  onSeek,
}: DynamicTrackWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [liveFreqs, setLiveFreqs] = useState<number[]>([]);

  const baseHeights = useMemo(() => generateTrackWaveform(trackId || 'default', 32), [trackId]);

  // Live animation loop for dancing audio bars when playing
  useEffect(() => {
    if (!isPlaying) {
      setLiveFreqs([]);
      return;
    }

    let animId: number;
    const update = () => {
      const data = audioVisualizer.getFrequencyData();
      if (data.length > 0) {
        const sampled: number[] = [];
        const step = Math.max(1, Math.floor(data.length / baseHeights.length));
        for (let i = 0; i < baseHeights.length; i++) {
          sampled.push((data[i * step] || 0) / 255);
        }
        setLiveFreqs(sampled);
      } else {
        // Fallback synthetic wave animation if Web Audio analyser is quiet
        const t = performance.now() * 0.006;
        const synth = baseHeights.map((_, i) => Math.sin(t + i * 0.4) * 0.25 + 0.25);
        setLiveFreqs(synth);
      }
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, baseHeights.length]);

  const currentRatio = duration > 0 ? currentTime / duration : 0;
  const activeRatio = isDragging && dragRatio !== null ? dragRatio : currentRatio;

  const calculateRatioFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    const ratio = calculateRatioFromClientX(e.clientX);
    setDragRatio(ratio);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const ratio = calculateRatioFromClientX(e.clientX);
    setDragRatio(ratio);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    const finalRatio = calculateRatioFromClientX(e.clientX);
    setDragRatio(null);
    onSeek(finalRatio * (duration || 1));
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="w-full flex items-center justify-between gap-1 h-9 py-1 px-1 cursor-pointer select-none touch-none group"
      aria-label="Интерактивная волна трека"
    >
      {baseHeights.map((baseH, idx) => {
        const barRatio = idx / (baseHeights.length - 1);
        const isPassed = activeRatio >= barRatio;
        const liveAmp = liveFreqs[idx] || 0;

        // Dynamic height modulation when playing
        const dynamicH = isPlaying
          ? Math.max(6, Math.min(32, baseH + liveAmp * 12))
          : baseH;

        return (
          <div
            key={idx}
            className="flex-1 flex items-center justify-center h-full min-w-[2px]"
          >
            <div
              className={`w-full max-w-[4px] rounded-full transition-all duration-75 ${
                isPassed
                  ? 'bg-accent shadow-[0_0_8px_rgba(255,59,92,0.6)]'
                  : 'bg-dark-surface-container-highest group-hover:bg-dark-outline'
              }`}
              style={{
                height: `${dynamicH}px`,
                transform: isPassed ? 'scaleY(1)' : 'scaleY(0.95)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
export default DynamicTrackWaveform;
