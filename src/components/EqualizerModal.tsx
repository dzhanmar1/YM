import React, { useEffect, useRef } from 'react';
import { X, RotateCcw, Volume2, Sliders } from 'lucide-react';
import { useEqualizerStore, EQ_FREQUENCIES, EQ_PRESETS } from '../store/equalizerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { EqualizerPreset } from '../types';
import { audioVisualizer } from '../utils/audioVisualizer';

const PRESET_LABELS: Record<EqualizerPreset, string> = {
  flat: 'Обычный',
  bass_boost: 'Бас',
  vocal_boost: 'Вокал',
  rock: 'Рок',
  electronic: 'Клубный',
  acoustic: 'Акустика',
  chill: 'Релакс',
  custom: 'Ручной',
};

export const EqualizerModal: React.FC = () => {
  const isMobile = useIsMobile();
  const {
    enabled,
    preAmp,
    bands,
    preset,
    modalOpen,
    setBand,
    setPreAmp,
    setPreset,
    setEnabled,
    setModalOpen,
    reset,
  } = useEqualizerStore();

  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, setModalOpen]);

  // Real-time audio spectrum analyzer background
  useEffect(() => {
    if (!modalOpen) return;
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const freq = audioVisualizer.getFrequencyData();
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const numBars = 52;
      const barW = (w / numBars) - 1.5;
      const fStep = Math.max(1, Math.floor((freq.length || 1) / numBars));

      for (let i = 0; i < numBars; i++) {
        const val = freq.length > 0 ? (freq[Math.min(freq.length - 1, i * fStep)] || 0) / 255 : 0;
        const barH = val * h * 0.88;
        const x = i * (barW + 1.5);
        const y = h - barH;

        // Subtle neon ambient bar
        ctx.fillStyle = `rgba(255, 59, 92, ${0.06 + val * 0.32})`;
        ctx.fillRect(x, y, barW, barH);

        // Bright peak cap
        if (barH > 2) {
          ctx.fillStyle = `rgba(255, 59, 92, ${0.45 + val * 0.55})`;
          ctx.fillRect(x, y, barW, 2);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [modalOpen]);

  if (!modalOpen) return null;

  // Generate SVG curve points for visualizer
  const width = 640;
  const height = 110;
  const zeroY = height / 2;
  const stepX = width / (EQ_FREQUENCIES.length - 1);

  const points = bands.map((db, idx) => {
    const x = idx * stepX;
    // Map -12dB ... +12dB to height ... 0
    const y = zeroY - (db / 12) * (height / 2 - 12);
    return `${x},${y}`;
  });
  const pathD = `M 0,${zeroY} L ${points.join(' L ')} L ${width},${zeroY}`;
  const fillD = `M 0,${zeroY} L ${points.join(' L ')} L ${width},${zeroY} Z`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fade-in"
      onClick={() => setModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-2xl bg-dark-surface border border-dark-outline-variant/40 shadow-2xl flex flex-col gap-4 overflow-hidden text-dark-on-surface ${
          isMobile
            ? 'rounded-t-3xl max-h-[92vh] animate-sheet-up pb-[calc(18px+var(--sab,0px))] px-5 pt-3'
            : 'rounded-2xl max-h-[90vh] p-6'
        }`}
      >
        {/* Mobile Swipe / Drag Indicator */}
        {isMobile && (
          <div className="flex justify-center pb-1">
            <span className="w-10 h-1 rounded-full bg-dark-outline-variant hover:bg-muted transition-colors" />
          </div>
        )}

        {/* Header Block */}
        <div className="flex items-center justify-between border-b border-dark-outline-variant/30 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="font-headline text-title-md sm:text-title-lg text-dark-on-surface">
                Эквалайзер
              </h2>
              <p className="font-body text-body-sm text-muted">
                10-полосный эквалайзер и профили звучания
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active / Bypass Switch */}
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`font-label text-label-sm px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                enabled
                  ? 'bg-accent text-dark-surface border-accent font-bold shadow-md shadow-accent/20'
                  : 'bg-dark-surface-container-low text-muted border-dark-outline-variant hover:text-dark-on-surface'
              }`}
            >
              {enabled ? 'Включен' : 'Выключен'}
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={reset}
              title="Сбросить все полосы в 0 dB"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-surface-container-low border border-dark-outline-variant text-muted hover:text-dark-on-surface text-label-sm active:scale-95 transition-all"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Сбросить</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Закрыть"
              className="w-8 h-8 rounded-lg bg-dark-surface-container-low border border-dark-outline-variant text-muted hover:text-dark-on-surface flex items-center justify-center active:scale-95 transition-transform"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Real-time Spectrum Analyzer & Parametric EQ Display */}
        <div className="relative h-28 bg-dark-surface-container-lowest border border-dark-outline-variant/40 rounded-xl overflow-hidden shrink-0">
          {/* Background Canvas: Real-time Audio Frequency Spectrum */}
          <canvas
            ref={spectrumCanvasRef}
            width={width}
            height={height}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Dotted Reference Grid: +12dB, 0dB, -12dB */}
          <div className="absolute inset-0 flex flex-col justify-between p-2.5 pointer-events-none text-mono-sm font-mono text-muted/50">
            <div className="flex justify-between text-[9px]">
              <span>+12 dB</span>
              <span>20 kHz</span>
            </div>
            <div className="border-b border-dashed border-dark-outline-variant/30 w-full" />
            <div className="flex justify-between text-[9px] text-muted">
              <span>0 dB</span>
              <span>1 kHz</span>
            </div>
            <div className="border-b border-dashed border-dark-outline-variant/30 w-full" />
            <div className="flex justify-between text-[9px]">
              <span>-12 dB</span>
              <span>20 Hz</span>
            </div>
          </div>

          {/* Foreground SVG Curve: Parametric Filter Response */}
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 pointer-events-none"
          >
            <path d={fillD} fill="rgba(255, 59, 92, 0.15)" />
            <path
              d={pathD}
              fill="none"
              stroke={enabled ? '#FF3B5C' : '#555555'}
              strokeWidth={2.5}
            />
          </svg>
        </div>

        {/* Presets Horizontal Selector Bank */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(Object.keys(EQ_PRESETS) as EqualizerPreset[]).map((pKey) => {
            const isActive = preset === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => setPreset(pKey)}
                className={`font-label text-label-sm px-3 py-1.5 rounded-full border whitespace-nowrap active:scale-95 transition-all ${
                  isActive
                    ? 'bg-accent/20 border-accent text-accent font-semibold shadow-sm'
                    : 'bg-dark-surface-container-low border-dark-outline-variant text-muted hover:text-dark-on-surface'
                }`}
              >
                {PRESET_LABELS[pKey]}
              </button>
            );
          })}
        </div>

        {/* Precision Fader Rails Section */}
        <div className="flex items-end justify-between gap-1 sm:gap-2.5 p-3 bg-dark-surface-container-low/60 border border-dark-outline-variant/40 rounded-xl overflow-x-auto no-scrollbar">
          {/* Pre-Amp Fader */}
          <div className="flex flex-col items-center gap-2 border-r border-dark-outline-variant/40 pr-3 sm:pr-4 pl-1">
            <span
              onClick={() => setPreAmp(0)}
              title="Нажмите для сброса в 0 dB"
              className={`font-mono text-[10px] tabular-nums font-bold cursor-pointer hover:underline ${
                preAmp !== 0 ? 'text-accent' : 'text-muted'
              }`}
            >
              {preAmp > 0 ? `+${preAmp}` : preAmp}
            </span>
            <div className="h-28 sm:h-32 flex items-center relative">
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={preAmp}
                disabled={!enabled}
                onChange={(e) => setPreAmp(parseFloat(e.target.value))}
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  accentColor: '#FF3B5C',
                }}
                className="h-24 sm:h-28 w-4 cursor-pointer disabled:opacity-40"
              />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Volume2 size={10} className="text-muted" />
              <span className="font-mono text-[10px] font-bold text-muted">PRE</span>
            </div>
          </div>

          {/* 10 Band Faders */}
          {EQ_FREQUENCIES.map((freq, idx) => {
            const db = bands[idx] ?? 0;
            const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
            return (
              <div key={freq} className="flex flex-col items-center gap-2 flex-1 min-w-[24px]">
                <span
                  onClick={() => setBand(idx, 0)}
                  title="Нажмите для сброса в 0 dB"
                  className={`font-mono text-[10px] tabular-nums font-bold cursor-pointer hover:underline ${
                    db !== 0 ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {db > 0 ? `+${db}` : db}
                </span>
                <div className="h-28 sm:h-32 flex items-center relative">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={db}
                    disabled={!enabled}
                    onChange={(e) => setBand(idx, parseFloat(e.target.value))}
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                      accentColor: '#FF3B5C',
                    }}
                    className="h-24 sm:h-28 w-4 cursor-pointer disabled:opacity-40"
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold text-muted mt-1">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
