import React, { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Play, Pause, SkipBack, SkipForward, Heart, Disc,
  Maximize2, Minimize2, ExternalLink, Sliders, ListMusic, Mic2, Radio,
  Volume2, VolumeX, X
} from 'lucide-react';
import { formatCoverUrl, formatDuration, EqualizerPreset } from '../types';
import type { TrackItem } from '../types';
import { MiniLyricsPanel } from './mini/MiniLyricsPanel';
import { MiniQueuePanel } from './mini/MiniQueuePanel';
import { MiniEqPanel } from './mini/MiniEqPanel';
import { MiniWavePanel } from './mini/MiniWavePanel';

// ─── Types ─────────────────────────────────────────────────────────────────
interface LyricLine { time_ms: number; text: string; }

interface MiniMetaState {
  currentTrack: TrackItem | null;
  isPlaying: boolean;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLiked: boolean;
  queue: TrackItem[];
  queueIndex: number;
  lyrics: { lines: LyricLine[]; is_synced: boolean } | null;
  eqPreset?: EqualizerPreset;
  waveMode?: boolean;
  waveStationId?: string;
  waveModeId?: string;
}

interface MiniTimeState {
  currentTime: number;
  activeLineIndex: number;
}

type MiniSubState = 'docked' | 'micro' | 'full' | 'karaoke' | 'queue' | 'eq' | 'wave_settings';

// Window Dimensions per state (logical pixels)
const STATE_DIMS: Record<MiniSubState, { width: number; height: number }> = {
  docked:        { width: 420, height: 34 },
  micro:         { width: 360, height: 44 },
  full:          { width: 420, height: 165 },
  karaoke:       { width: 420, height: 420 },
  queue:         { width: 420, height: 380 },
  eq:            { width: 420, height: 260 },
  wave_settings: { width: 420, height: 320 },
};

const EQ_PRESET_LIST: { id: EqualizerPreset; label: string }[] = [
  { id: 'flat',        label: 'ОБЫЧНЫЙ' },
  { id: 'bass_boost',  label: 'БАС ++' },
  { id: 'vocal_boost', label: 'ВОКАЛ' },
  { id: 'rock',        label: 'РОК' },
  { id: 'electronic',  label: 'ЭЛЕКТРО' },
  { id: 'chill',       label: 'РЕЛАКС' },
];

export function MiniPlayerWindow() {
  const [meta, setMeta] = useState<MiniMetaState>({
    currentTrack: null,
    isPlaying: false,
    duration: 0,
    volume: 0.85,
    isMuted: false,
    isLiked: false,
    queue: [],
    queueIndex: 0,
    lyrics: null,
    eqPreset: 'flat',
    waveMode: false,
    waveStationId: '',
    waveModeId: '',
  });

  const [time, setTime] = useState<MiniTimeState>({
    currentTime: 0,
    activeLineIndex: -1,
  });

  const [subState, setSubState] = useState<MiniSubState>('full');

  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lastActionTimeRef = useRef(0);

  // Background visualizer refs
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioEnergyRef = useRef<{ bass: number; mid: number; peak: number; bars: number[] }>({
    bass: 0,
    mid: 0,
    peak: 0,
    bars: [0, 0, 0, 0, 0, 0, 0, 0],
  });

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.mp-nodrag, button, input, [role="button"]')) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  }, []);

  // ─── Anchored Resize (grows UPWARDS from bottom-right) ─────────────────
  const resizeToState = useCallback(async (s: MiniSubState) => {
    const { width, height } = STATE_DIMS[s];
    try {
      await invoke('cmd_resize_mini_anchored', { width, height });
    } catch {
      await invoke('cmd_resize_mini', { width, height }).catch(() => {});
    }
  }, []);

  const switchState = useCallback(async (s: MiniSubState) => {
    const currentH = STATE_DIMS[subState].height;
    const targetH = STATE_DIMS[s].height;

    if (targetH >= currentH) {
      // Expanding: resize the OS window first, then render larger UI
      await resizeToState(s);
      setSubState(s);
    } else {
      // Shrinking: render the compact UI first, then resize the OS window
      setSubState(s);
      await resizeToState(s);
    }
  }, [resizeToState, subState]);

  // Force exact window dimensions on mount
  useEffect(() => {
    resizeToState('full');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Intercept window close → restore main instead ────────────────────
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    win.onCloseRequested(async (event) => {
      event.preventDefault();
      try { await invoke('cmd_hide_mini_player'); } catch {}
    }).then((u) => { unlisten = u; });
    return () => { if (unlisten) unlisten(); };
  }, []);

  // ─── Listen to player state & lightweight time sync events ────────────
  useEffect(() => {
    let uState: (() => void) | undefined;
    let uTime: (() => void) | undefined;
    let uShow: (() => void) | undefined;
    let uEnergy: (() => void) | undefined;

    // When shown from main window, ensure state is set to full
    listen('mini-show', () => {
      setSubState('full');
      resizeToState('full');
    }).then((fn) => { uShow = fn; });

    listen<MiniMetaState & Partial<MiniTimeState>>('player-state', (event) => {
      const p = event.payload;
      setMeta({
        currentTrack: p.currentTrack,
        isPlaying: p.isPlaying,
        duration: p.duration,
        volume: p.volume,
        isMuted: p.isMuted,
        isLiked: p.isLiked,
        queue: p.queue || [],
        queueIndex: p.queueIndex || 0,
        lyrics: p.lyrics || null,
        eqPreset: p.eqPreset || 'flat',
        waveMode: p.waveMode ?? false,
        waveStationId: p.waveStationId ?? '',
        waveModeId: p.waveModeId ?? '',
      });
      if (typeof p.currentTime === 'number') {
        setTime({
          currentTime: p.currentTime,
          activeLineIndex: typeof p.activeLineIndex === 'number' ? p.activeLineIndex : -1,
        });
      }
    }).then((fn) => { uState = fn; });

    listen<MiniTimeState>('player-time', (event) => {
      setTime(event.payload);
    }).then((fn) => { uTime = fn; });

    listen<{ bass: number; mid: number; peak: number; bars: number[] }>('audio-energy', (event) => {
      audioEnergyRef.current = event.payload;
    }).then((fn) => { uEnergy = fn; });

    // Request initial fresh state immediately on mount
    invoke('cmd_mini_action', { action: 'request_state', payload: null }).catch(() => {});

    return () => {
      if (uShow) uShow();
      if (uState) uState();
      if (uTime) uTime();
      if (uEnergy) uEnergy();
    };
  }, []);

  // ─── Send action with debounce (for skip-type actions) ───────────────
  const sendAction = useCallback(async (action: string, payload?: unknown) => {
    const now = Date.now();
    // Apply debounce only to prev/next to prevent double-skipping
    if ((action === 'next' || action === 'prev') && now - lastActionTimeRef.current < 500) return;
    lastActionTimeRef.current = now;

    try {
      await invoke('cmd_mini_action', {
        action,
        payload: payload !== undefined ? JSON.stringify(payload) : null,
      });
    } catch (e) {
      console.error('mini action error:', e);
    }
  }, []);

  // ─── Play / Pause Action ───────────────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    // Optimistically toggle for instant UI feedback
    setMeta((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
    sendAction('toggle_play');
    // Request fresh state from main window after a short delay to ensure sync
    setTimeout(() => {
      invoke('cmd_mini_action', { action: 'request_state', payload: null }).catch(() => {});
    }, 150);
  }, [sendAction]);

  const handlePrev = () => sendAction('prev');
  const handleNext = () => sendAction('next');
  const handleLike = () => {
    if (meta.currentTrack) {
      setMeta((prev) => ({ ...prev, isLiked: !prev.isLiked }));
      sendAction('like', meta.currentTrack);
    }
  };

  const handleExpandToMain = async () => {
    try { await invoke('cmd_hide_mini_player'); } catch {}
  };

  // Auto-scroll active lyric
  useEffect(() => {
    if (subState === 'karaoke' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [time.activeLineIndex, subState]);

  // ─── Background Audio Visualizer Canvas Loop ──────────────────────────
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let smoothBass = 0;
    let smoothMid = 0;
    const smoothBars = new Float32Array(8);

    const renderBg = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(rect.width * dpr);
      const targetH = Math.floor(rect.height * dpr);

      if (targetW > 0 && targetH > 0 && (canvas.width !== targetW || canvas.height !== targetH)) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const target = audioEnergyRef.current;
      smoothBass += (target.bass - smoothBass) * 0.18;
      smoothMid += (target.mid - smoothMid) * 0.16;

      for (let i = 0; i < 8; i++) {
        const tb = target.bars[i] || 0;
        smoothBars[i] += (tb - smoothBars[i]) * 0.22;
      }

      // Draw reactive background wave & spectrum when playing or fading
      const hasEnergy = smoothBass > 0.005 || smoothBars.some((b) => b > 0.005);
      if (hasEnergy) {
        // 1. Subtle warm ambient pulse
        const auraGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.8);
        auraGrad.addColorStop(0, `rgba(249, 202, 36, ${Math.min(0.09, smoothBass * 0.12)})`);
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.fillRect(0, 0, w, h);

        // 2. Flowing acoustic sound wave curve across the lower background
        ctx.beginPath();
        const pts = 36;
        ctx.moveTo(0, h);
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * w;
          const barIdx = Math.min(7, Math.floor((i / pts) * 8));
          const val = smoothBars[barIdx] || 0;
          const wave = Math.sin(i * 0.45 + Date.now() * 0.0035) * (3 + smoothBass * 4);
          const y = h - (val * (h * 0.55) + wave + 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();

        const waveGrad = ctx.createLinearGradient(0, h * 0.4, 0, h);
        waveGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.18, 0.04 + smoothBass * 0.15)})`);
        waveGrad.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
        ctx.fillStyle = waveGrad;
        ctx.fill();

        // 3. Crisp luminescent upper contour line
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * w;
          const barIdx = Math.min(7, Math.floor((i / pts) * 8));
          const val = smoothBars[barIdx] || 0;
          const wave = Math.sin(i * 0.45 + Date.now() * 0.0035) * (3 + smoothBass * 4);
          const y = h - (val * (h * 0.55) + wave + 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.45, 0.12 + smoothBass * 0.4)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Only schedule next frame if playing or still fading out
      if (meta.isPlaying || hasEnergy) {
        animId = requestAnimationFrame(renderBg);
      }
    };

    animId = requestAnimationFrame(renderBg);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [meta.isPlaying]);

  const { currentTrack, isPlaying, isLiked, duration, volume, isMuted, queue, queueIndex, lyrics, eqPreset } = meta;
  const { currentTime, activeLineIndex } = time;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const coverUrl = currentTrack?.cover_uri ? formatCoverUrl(currentTrack.cover_uri, '200x200') : null;
  const microCoverUrl = currentTrack?.cover_uri ? formatCoverUrl(currentTrack.cover_uri, '100x100') : null;

  const titleDisplay = currentTrack?.title || 'YM DESKTOP';
  const artistDisplay = currentTrack?.artists?.join(', ') || 'Музыка не воспроизводится';

  const getWaveStatusLabel = () => {
    if (!meta.waveMode) return null;
    const cur = meta.waveModeId || '';
    
    // Activity mode - uses its own station
    if (cur.startsWith('activity:')) {
      const id = cur.replace('activity:', '');
      const map: Record<string, string> = {
        work: 'РАБОТА',
        'work-background': 'РАБОТА',
        sport: 'СПОРТ',
        workout: 'СПОРТ',
        road: 'ДОРОГА',
        driving: 'ДОРОГА',
        wakeup: 'УТРО',
        'wake-up': 'УТРО',
        sleep: 'СОН',
        'fall-asleep': 'СОН',
      };
      return `ВОЛНА // ${map[id] || id.toUpperCase()}`;
    }
    
    // Combined mood + character (joined by +)
    if (cur.includes('mood:') || cur.includes('character:')) {
      const parts = cur.split('+');
      const labels: string[] = [];
      for (const part of parts) {
        if (part.startsWith('mood:')) {
          const id = part.replace('mood:', '');
          const map: Record<string, string> = { active: 'БОДРОЕ', fun: 'РАДОСТНОЕ', calm: 'СПОКОЙНОЕ', sad: 'ГРУСТНОЕ' };
          labels.push(map[id] || id.toUpperCase());
        } else if (part.startsWith('character:')) {
          const id = part.replace('character:', '');
          const map: Record<string, string> = { favorite: 'ЛЮБИМОЕ', discover: 'НЕЗНАКОМОЕ', popular: 'ПОПУЛЯРНОЕ' };
          labels.push(map[id] || id.toUpperCase());
        }
      }
      if (labels.length > 0) return `ВОЛНА // ${labels.join(' + ')}`;
    }
    
    // Default wave (user:onyourwave)
    return 'МОЯ ВОЛНА';
  };

  const waveStatusLabel = getWaveStatusLabel();

  return (
    <div
      className={`mp-shell ${isPlaying ? 'mp-pulse-active' : ''}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Real-time reactive background audio spectrum & waveform visualizer */}
      <canvas
        ref={bgCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Ambient background illumination - only active on full player, never during menus */}
      {isPlaying && coverUrl && subState === 'full' && (
        <div
          style={{
            position: 'absolute',
            inset: -24,
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(36px) saturate(2) brightness(0.25)',
            opacity: 0.5,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* ── 1. DOCKED STATUS INDICATOR ──────────────────────────────────── */}
      {subState === 'docked' && (
        <div
          className="mp-docked-strip mp-drag"
          data-tauri-drag-region
          onMouseDown={handleDragMouseDown}
          onClick={() => switchState('full')}
          title="Клик: развернуть плеер"
        >
          <div className="mp-docked-left">
            <button
              className="mp-nodrag"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePlay();
              }}
              title={isPlaying ? 'Пауза' : 'Воспроизведение'}
              style={{
                width: 18,
                height: 18,
                backgroundColor: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                borderRadius: 1,
                padding: 0,
              }}
            >
              {isPlaying ? (
                <div style={{ display: 'flex', gap: 2 }}>
                  <span style={{ width: 2, height: 7, background: '#000' }} />
                  <span style={{ width: 2, height: 7, background: '#000' }} />
                </div>
              ) : (
                <div style={{
                  width: 0, height: 0,
                  borderStyle: 'solid',
                  borderWidth: '3.5px 0 3.5px 6px',
                  borderColor: 'transparent transparent transparent #000000',
                  marginLeft: 1,
                }} />
              )}
            </button>
            <span>{isPlaying ? 'СЕЙЧАС ИГРАЕТ:' : 'ПАУЗА:'}</span>
          </div>
          <div className="mp-docked-right" data-tauri-drag-region>
            <span>{titleDisplay} — {artistDisplay}</span>
            <span className="mp-docked-cursor" />
          </div>
        </div>
      )}

      {/* ── 2. MICRO BAR STATE ──────────────────────────────────────────── */}
      {subState === 'micro' && (
        <div
          className="mp-micro-bar mp-drag"
          data-tauri-drag-region
          onMouseDown={handleDragMouseDown}
          onClick={() => switchState('full')}
          title="Клик: открыть мини-плеер"
        >
          {/* Micro Square Cover */}
          <div className="mp-micro-cover" data-tauri-drag-region>
            {microCoverUrl ? (
              <img src={microCoverUrl} alt="" />
            ) : (
              <Disc size={16} color="#555" />
            )}
          </div>

          {/* Micro Play/Pause Quick Toggle */}
          <button
            className="mp-nodrag mp-micro-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePlay();
            }}
            title={isPlaying ? 'Пауза' : 'Воспроизведение'}
            style={{
              width: 22,
              height: 22,
              backgroundColor: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              borderRadius: 1,
              padding: 0,
            }}
          >
            {isPlaying ? (
              <div style={{ display: 'flex', gap: 2 }}>
                <span style={{ width: 2.5, height: 8, background: '#000' }} />
                <span style={{ width: 2.5, height: 8, background: '#000' }} />
              </div>
            ) : (
              <div style={{
                width: 0, height: 0,
                borderStyle: 'solid',
                borderWidth: '4px 0 4px 7px',
                borderColor: 'transparent transparent transparent #000000',
                marginLeft: 1,
              }} />
            )}
          </button>

          {/* Micro Metadata */}
          <div className="mp-micro-meta" data-tauri-drag-region>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} data-tauri-drag-region>
              {waveStatusLabel && (
                <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#a3021a', fontWeight: 900 }}>
                  [ • ]
                </span>
              )}
              <span className="mp-micro-title">{titleDisplay}</span>
            </div>
            <span className="mp-micro-artist">{artistDisplay}</span>
          </div>

          {/* Micro Duration */}
          <span className="mp-micro-time" data-tauri-drag-region>
            {formatDuration(currentTime * 1000)} / {formatDuration(duration * 1000)}
          </span>

          {/* Micro Bottom Progress Line */}
          <div className="mp-micro-prog-track">
            <div className="mp-micro-prog-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* ── 3. FULL MINI PLAYER ─────────────────────────────────────────── */}
      {subState === 'full' && (
        <div className="mp-full-container">
          {/* Left: Square Artwork */}
          <div
            className="mp-art-box mp-drag"
            data-tauri-drag-region
            onMouseDown={handleDragMouseDown}
            style={{ position: 'relative' }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" data-tauri-drag-region />
            ) : (
              <div
                data-tauri-drag-region
                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d' }}
              >
                <Disc size={36} color="#444" />
              </div>
            )}
          </div>

          {/* Right: Meta, Scrubber, Controls */}
          <div className="mp-meta-panel">
            {/* Row 1: Header Badge & Controls */}
            <div
              className="mp-top-row mp-drag"
              data-tauri-drag-region
              onMouseDown={handleDragMouseDown}
            >
              <span
                className="mp-top-badge"
                data-tauri-drag-region
                style={{
                  color: waveStatusLabel ? '#a3021a' : isPlaying ? '#ffffff' : '#666666',
                  fontWeight: 800,
                }}
              >
                {waveStatusLabel ? `[ • ] ${waveStatusLabel}` : isPlaying ? 'ВОСПРОИЗВЕДЕНИЕ' : 'ПАУЗА'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="mp-expand-btn mp-nodrag"
                  onClick={() => switchState('micro')}
                  title="Компактный режим"
                >
                  <Minimize2 size={12} />
                </button>
                <button
                  className="mp-expand-btn mp-nodrag"
                  onClick={handleExpandToMain}
                  title="Развернуть в полное окно"
                >
                  <Maximize2 size={12} />
                </button>
              </div>
            </div>

            {/* Title & Artist (Clean, Solid White, No Glitch) */}
            <div
              className="mp-drag"
              data-tauri-drag-region
              onMouseDown={handleDragMouseDown}
            >
              <div className="mp-track-title" title={titleDisplay} data-tauri-drag-region>
                {titleDisplay}
              </div>
              <div className="mp-track-artist" title={artistDisplay} data-tauri-drag-region>
                {artistDisplay}
              </div>
            </div>

            {/* Progress Bar with Square Thumb */}
            <div className="mp-prog-container mp-nodrag">
              <div
                className="mp-prog-bar"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  sendAction('seek', ratio * duration);
                }}
              >
                <div className="mp-prog-loaded" style={{ width: `${progressPercent}%` }} />
                <div className="mp-prog-thumb" style={{ left: `${progressPercent}%` }} />
              </div>
              <div className="mp-prog-times">
                <span className="mp-prog-time-cur">{formatDuration(currentTime * 1000)}</span>
                <span>{formatDuration(duration * 1000)}</span>
              </div>
            </div>

            {/* Bottom Controls Row */}
            <div className="mp-actions-row mp-nodrag">
              {/* Playback Controls: Prev, Play, Next, Like */}
              <div className="mp-controls-playback">
                <button
                  className="mp-btn"
                  onClick={handlePrev}
                  title="Предыдущий трек"
                >
                  <SkipBack size={14} fill="currentColor" />
                </button>

                {/* White Square Play Button */}
                <button
                  className="mp-square-play"
                  onClick={handleTogglePlay}
                  title={isPlaying ? 'Пауза' : 'Воспроизведение'}
                >
                  {isPlaying ? (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <span style={{ width: 3, height: 12, background: '#000' }} />
                      <span style={{ width: 3, height: 12, background: '#000' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: 0, height: 0,
                      borderStyle: 'solid',
                      borderWidth: '6px 0 6px 11px',
                      borderColor: 'transparent transparent transparent #000000',
                      marginLeft: 2,
                    }} />
                  )}
                </button>

                <button
                  className="mp-btn"
                  onClick={handleNext}
                  title="Следующий трек"
                >
                  <SkipForward size={14} fill="currentColor" />
                </button>

                <button
                  className="mp-btn"
                  onClick={handleLike}
                  style={{ color: isLiked ? '#ff3344' : 'inherit' }}
                  title={isLiked ? 'В любимых' : 'Добавить в любимые'}
                >
                  <Heart size={14} fill={isLiked ? '#ff3344' : 'transparent'} color={isLiked ? '#ff3344' : 'currentColor'} />
                </button>
              </div>

              {/* Tool Controls: Wave, EQ, Queue, Lyrics */}
              <div className="mp-controls-tools">
                <button
                  className="mp-btn"
                  onClick={() => switchState('wave_settings')}
                  title="Настройки Моей Волны"
                >
                  <Radio size={14} />
                </button>

                <button
                  className="mp-btn"
                  onClick={() => switchState('eq')}
                  title="Эквалайзер"
                >
                  <Sliders size={14} />
                </button>

                <button
                  className="mp-btn"
                  onClick={() => switchState('queue')}
                  title="Очередь воспроизведения"
                >
                  <ListMusic size={14} />
                </button>

                <button
                  className="mp-btn"
                  onClick={() => switchState('karaoke')}
                  title="Текст песни"
                >
                  <Mic2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. SYNCED LYRICS VIEW ───────────────────────────────────────── */}
      {subState === 'karaoke' && (
        <MiniLyricsPanel
          lyrics={lyrics}
          activeLineIndex={activeLineIndex}
          isPlaying={isPlaying}
          titleDisplay={titleDisplay}
          currentTime={currentTime}
          duration={duration}
          onClose={() => switchState('full')}
          onTogglePlay={handleTogglePlay}
          sendAction={sendAction}
        />
      )}

      {/* ── 5. QUEUE VIEW ───────────────────────────────────────────────── */}
      {subState === 'queue' && (
        <MiniQueuePanel
          queue={queue}
          queueIndex={queueIndex}
          isPlaying={isPlaying}
          titleDisplay={titleDisplay}
          currentTime={currentTime}
          duration={duration}
          onClose={() => switchState('full')}
          onTogglePlay={handleTogglePlay}
          sendAction={sendAction}
        />
      )}

      {/* ── 6. EQUALIZER PRESETS VIEW ───────────────────────────────────── */}
      {subState === 'eq' && (
        <MiniEqPanel
          eqPreset={eqPreset || 'flat'}
          isPlaying={isPlaying}
          titleDisplay={titleDisplay}
          currentTime={currentTime}
          duration={duration}
          onClose={() => switchState('full')}
          onTogglePlay={handleTogglePlay}
          sendAction={sendAction}
        />
      )}

      {/* ── 7. WAVE SETTINGS VIEW ───────────────────────────────────────── */}
      {subState === 'wave_settings' && (
        <MiniWavePanel
          meta={{
            waveMode: Boolean(meta.waveMode),
            waveStationId: meta.waveStationId ?? '',
            waveModeId: meta.waveModeId,
          }}
          onClose={() => switchState('full')}
          sendAction={sendAction}
        />
      )}
    </div>
  );
}
