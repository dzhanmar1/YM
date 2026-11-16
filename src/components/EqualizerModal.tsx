import React, { useEffect, useRef } from 'react';
import { X, RotateCcw, Volume2, Sliders } from 'lucide-react';
import { useEqualizerStore, EQ_FREQUENCIES, EQ_PRESETS } from '../store/equalizerStore';
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

        // Subtle ambient bar
        ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + val * 0.22})`;
        ctx.fillRect(x, y, barW, barH);

        // Bright peak cap
        if (barH > 2) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + val * 0.55})`;
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
  const height = 120;
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        userSelect: 'none',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={() => setModalOpen(false)}
    >
      <div
        style={{
          width: 720,
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0c0c0c',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: '24px 20px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.95), 0 0 32px rgba(163, 2, 26, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Block */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'rgba(163, 2, 26, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={18} color="#a3021a" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                Эквалайзер
              </div>
              <div style={{ fontSize: 12, color: '#888888', marginTop: 2 }}>
                10-полосный эквалайзер и профили звучания
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Active / Bypass Switch */}
            <button
              onClick={() => setEnabled(!enabled)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 8,
                border: enabled ? '1px solid #a3021a' : '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: enabled ? '#a3021a' : 'rgba(255, 255, 255, 0.05)',
                color: enabled ? '#ffffff' : '#888888',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {enabled ? 'Включен' : 'Выключен'}
            </button>

            {/* Reset */}
            <button
              onClick={reset}
              title="Сбросить все полосы в 0 dB"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#aaaaaa',
                cursor: 'pointer',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#aaaaaa')}
            >
              <RotateCcw size={13} />
              <span>Сбросить</span>
            </button>

            {/* Close */}
            <button
              onClick={() => setModalOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888888',
                cursor: 'pointer',
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 6,
                transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
              title="Закрыть (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Real-time Spectrum Analyzer & Parametric EQ Display */}
        <div
          style={{
            position: 'relative',
            height: height,
            backgroundColor: '#050505',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Background Canvas: Real-time Audio Frequency Spectrum */}
          <canvas
            ref={spectrumCanvasRef}
            width={width}
            height={height}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />

          {/* Dotted Reference Grid: +12dB, +6dB, 0dB, -6dB, -12dB */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '8px 12px',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255, 255, 255, 0.3)' }}>
              <span>+12 dB</span>
              <span>20 kHz</span>
            </div>
            <div style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)', width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255, 255, 255, 0.5)' }}>
              <span>0 dB</span>
              <span>1 kHz</span>
            </div>
            <div style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.08)', width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255, 255, 255, 0.3)' }}>
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
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <path d={fillD} fill="rgba(163, 2, 26, 0.15)" />
            <path
              d={pathD}
              fill="none"
              stroke={enabled ? '#a3021a' : '#555555'}
              strokeWidth={2.5}
            />
          </svg>
        </div>

        {/* Presets Horizontal Selector Bank */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(EQ_PRESETS) as EqualizerPreset[]).map((pKey) => {
            const isActive = preset === pKey;
            return (
              <button
                key={pKey}
                onClick={() => setPreset(pKey)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: isActive ? '#a3021a' : 'rgba(255, 255, 255, 0.08)',
                  backgroundColor: isActive ? 'rgba(163, 2, 26, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? '#ffffff' : '#888888',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = '#888888';
                }}
              >
                {PRESET_LABELS[pKey]}
              </button>
            );
          })}
        </div>

        {/* Precision Fader Rails Section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 10,
            padding: '16px 12px 10px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            overflowX: 'auto',
          }}
        >
          {/* Pre-Amp Fader */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              paddingRight: 16,
              paddingLeft: 4,
            }}
          >
            <span
              onClick={() => setPreAmp(0)}
              title="Нажмите для сброса в 0 dB"
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: preAmp !== 0 ? '#a3021a' : '#666666',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {preAmp > 0 ? `+${preAmp}` : preAmp}
            </span>
            <div style={{ height: 140, display: 'flex', alignItems: 'center', position: 'relative' }}>
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
                  height: 130,
                  width: 14,
                  accentColor: '#a3021a',
                  cursor: enabled ? 'pointer' : 'default',
                  opacity: enabled ? 1 : 0.4,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Volume2 size={11} color="#666666" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888888', fontWeight: 700 }}>
                PRE
              </span>
            </div>
          </div>

          {/* 10 Band Faders */}
          {EQ_FREQUENCIES.map((freq, idx) => {
            const db = bands[idx] ?? 0;
            const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
            return (
              <div
                key={freq}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                }}
              >
                <span
                  onClick={() => setBand(idx, 0)}
                  title="Нажмите для сброса в 0 dB"
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: db !== 0 ? '#a3021a' : '#666666',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {db > 0 ? `+${db}` : db}
                </span>
                <div style={{ height: 140, display: 'flex', alignItems: 'center', position: 'relative' }}>
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
                      height: 130,
                      width: 14,
                      accentColor: '#a3021a',
                      cursor: enabled ? 'pointer' : 'default',
                      opacity: enabled ? 1 : 0.4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888888', fontWeight: 600, marginTop: 4 }}>
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
