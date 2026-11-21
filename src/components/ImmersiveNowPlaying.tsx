import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Sliders,
  Minimize2,
  Disc,
  Radio,
  Mic2,
  Volume2,
  VolumeX,
  Headphones,
  Maximize2,
  ListMusic,
} from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { useEqualizerStore } from '../store/equalizerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { AmbientBackgroundVisualizer } from './AmbientBackgroundVisualizer';
import { LyricsModal } from './LyricsModal';
import { formatCoverUrl, formatDuration } from '../types';
import { invoke, isTauri } from '@tauri-apps/api/core';

export function ImmersiveNowPlaying() {
  const isMobile = useIsMobile();
  const { nowPlayingOpen, studioPlayerOpen, setNowPlayingOpen } = useWindowStore();
  const isOpen = nowPlayingOpen || studioPlayerOpen;

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    repeat,
    volume,
    isMuted,
    togglePlay,
    playNext,
    playPrev,
    seek,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    isLiked,
    setVolume,
    toggleMute,
    waveMode,
    queue,
    queueIndex,
    playTrack,
  } = usePlayerStore();

  const { lyrics, activeLineIndex } = useLyricsStore();
  const { setModalOpen: setEqOpen } = useEqualizerStore();

  const [mobileTab, setMobileTab] = useState<'player' | 'lyrics' | 'queue'>('player');

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);

  // Auto-scroll active lyric into view
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  const coverUrl = currentTrack?.cover_uri
    ? formatCoverUrl(currentTrack.cover_uri, '600x600')
    : null;

  const trackLiked = currentTrack ? isLiked(currentTrack.id) : false;

  const calculateScrubRatio = useCallback((clientX: number) => {
    if (!scrubberRef.current) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  // Mouse Scrubber Handlers
  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsScrubbing(true);
    const initialRatio = calculateScrubRatio(e.clientX);
    setScrubPercent(initialRatio * 100);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const ratio = calculateScrubRatio(moveEvent.clientX);
      setScrubPercent(ratio * 100);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsScrubbing(false);
      setScrubPercent(null);
      const finalRatio = calculateScrubRatio(upEvent.clientX);
      seek(finalRatio * (duration || 1));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Touch Scrubber Handlers for Mobile
  const handleScrubberTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const touch = e.touches[0];
    const initialRatio = calculateScrubRatio(touch.clientX);
    setScrubPercent(initialRatio * 100);
  };

  const handleScrubberTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const touch = e.touches[0];
    const ratio = calculateScrubRatio(touch.clientX);
    setScrubPercent(ratio * 100);
  };

  const handleScrubberTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    const touch = e.changedTouches[0];
    const finalRatio = calculateScrubRatio(touch.clientX);
    setScrubPercent(null);
    seek(finalRatio * (duration || 1));
  };

  // Swipe down on header to dismiss
  const touchStartY = useRef<number | null>(null);
  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const diffY = e.changedTouches[0].clientY - touchStartY.current;
      if (diffY > 60) {
        setNowPlayingOpen(false);
      }
      touchStartY.current = null;
    }
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayedPercent = isScrubbing && scrubPercent !== null ? scrubPercent : currentPercent;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#070707',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        width: '100%',
        animation: 'slideUpNowPlaying 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        paddingTop: 'var(--sat)',
        paddingBottom: 'var(--sab)',
      }}
    >
      {/* Dynamic Ambient Background Visualizer */}
      <AmbientBackgroundVisualizer coverUrl={coverUrl} accentColor="#a3021a" opacity={0.65} />

      {/* MOBILE NOW PLAYING: YM Aura v2 Immersive Player & Lyrics */}
      {isMobile ? (
        mobileTab === 'lyrics' ? (
          <LyricsModal onBackToPlayer={() => setMobileTab('player')} />
        ) : mobileTab === 'queue' ? (
          <div className="h-full w-full max-w-md mx-auto flex flex-col justify-between relative overflow-hidden bg-dark-surface text-dark-on-surface antialiased select-none">
            {/* Context Header */}
            <header className="sticky top-0 z-20 bg-dark-surface/95 backdrop-blur-md px-page-margin pt-gutter-md pb-gutter-md flex items-center justify-between border-b border-dark-outline-variant/30 shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('player')}
                aria-label="Вернуться к плееру"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-surface-container-low border border-dark-outline-variant text-body-sm text-dark-on-surface active:scale-95 transition-transform"
              >
                <ChevronLeft size={16} />
                <span className="font-label text-label-sm">Плеер</span>
              </button>

              <div className="flex items-center gap-2">
                <ListMusic size={16} className="text-accent" />
                <h2 className="font-headline text-title-md text-dark-on-surface">
                  Очередь ({queue.length})
                </h2>
              </div>

              <div className="w-16" />
            </header>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-page-margin py-gutter-md flex flex-col gap-1.5">
              {queue.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted gap-2 py-24">
                  <ListMusic size={40} className="text-muted/60" />
                  <span className="font-body text-body-md">Очередь воспроизведения пуста</span>
                </div>
              ) : (
                queue.map((track, idx) => {
                  const isCurrent = idx === queueIndex;
                  const trackCover = track.cover_uri ? formatCoverUrl(track.cover_uri, '100x100') : null;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrack(track, queue, idx)}
                      className={`flex items-center justify-between gap-gutter-md p-gutter-sm rounded-xl cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-dark-surface-container-high border border-accent/40 shadow-sm'
                          : 'hover:bg-dark-surface-container-low active:bg-dark-surface-container'
                      }`}
                    >
                      <div className="flex items-center gap-gutter-md min-w-0 flex-1">
                        <span
                          className={`font-mono text-label-sm w-5 text-center tabular-nums shrink-0 ${
                            isCurrent ? 'text-accent font-bold' : 'text-muted'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        {trackCover ? (
                          <img
                            src={trackCover}
                            alt=""
                            className="w-11 h-11 rounded-md object-cover shrink-0 bg-dark-surface-container border border-dark-outline-variant/30"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-md bg-dark-surface-container flex items-center justify-center shrink-0 text-accent">
                            <Disc size={18} />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-title text-title-md truncate ${
                              isCurrent ? 'text-accent font-semibold' : 'text-dark-on-surface'
                            }`}
                          >
                            {track.title}
                          </span>
                          <span className="font-body text-body-sm text-muted truncate">
                            {track.artists.join(', ')}
                          </span>
                        </div>
                      </div>

                      <span className="font-mono text-label-sm text-muted tabular-nums shrink-0">
                        {formatDuration(track.duration_ms || 0)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div
            className="h-full w-full max-w-md mx-auto flex flex-col justify-between relative overflow-hidden px-page-margin pt-gutter-md pb-gutter-xl select-none"
            onTouchStart={handleHeaderTouchStart}
            onTouchEnd={handleHeaderTouchEnd}
          >
            {/* Ambient Cover Glow */}
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-accent opacity-15 blur-3xl" />

            {/* Minimal Top: Swipe-down Handle + Output Pill */}
            <header className="relative z-10 flex flex-col items-center gap-gutter-md shrink-0">
              <button
                type="button"
                onClick={() => setNowPlayingOpen(false)}
                aria-label="Свернуть плеер свайпом"
                className="py-gutter-xs px-gutter-xl focus:outline-none"
              >
                <span className="block w-10 h-1 rounded-full bg-dark-outline-variant hover:bg-muted transition-colors" />
              </button>

              <div className="w-full flex items-center justify-between">
                <div className="inline-flex items-center gap-gutter-xs px-gutter-md py-gutter-xs rounded-full bg-dark-surface-container-low border border-dark-outline-variant">
                  <Headphones size={14} className="text-accent" />
                  <span className="font-label text-label-sm text-dark-on-surface">Наушники</span>
                </div>

                <span className="font-mono text-label-sm text-muted px-gutter-sm py-gutter-xs rounded-full bg-dark-surface-container-low border border-dark-outline-variant">
                  LOSSLESS
                </span>
              </div>
            </header>

            {/* Expansive Cover Artwork Stage */}
            <main className="relative z-10 flex flex-col gap-gutter-lg my-auto py-gutter-md">
              <div className="w-full aspect-square max-w-[340px] mx-auto rounded-xl overflow-hidden bg-dark-surface-container shadow-2xl border border-dark-outline-variant">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={currentTrack?.title || ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-accent">
                    <Disc size={64} />
                  </div>
                )}
              </div>

              {/* Track Title & Artist + Heart */}
              <div className="flex items-center justify-between gap-gutter-md">
                <div className="flex flex-col gap-gutter-xs min-w-0">
                  <h1 className="font-display text-headline-lg text-dark-on-surface truncate">
                    {currentTrack?.title || 'Нет трека'}
                  </h1>
                  <p className="font-body text-title-md text-muted truncate">
                    {currentTrack?.artists.join(', ') || '—'}
                  </p>
                </div>

                {currentTrack && (
                  <button
                    type="button"
                    onClick={() => toggleLike(currentTrack)}
                    aria-label="Добавить в любимые"
                    className={`shrink-0 w-11 h-11 rounded-full bg-dark-surface-container-low border border-dark-outline-variant flex items-center justify-center active:scale-95 transition-transform duration-state-change ${
                      trackLiked ? 'text-accent' : 'text-muted hover:text-dark-on-surface'
                    }`}
                  >
                    <Heart size={20} fill={trackLiked ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>

              {/* Integrated Live Lyrics Peek (Tap to expand!) */}
              <button
                type="button"
                onClick={() => setMobileTab('lyrics')}
                className="w-full rounded-lg bg-dark-surface-container-low border border-dark-outline-variant px-gutter-lg py-gutter-md flex items-center justify-between gap-gutter-md hover:bg-dark-surface-container transition-colors duration-state-change text-left"
              >
                <div className="flex flex-col gap-gutter-xs min-w-0">
                  <span className="font-label text-label-sm text-accent">Текст сейчас</span>
                  <p className="font-headline text-body-md text-dark-on-surface truncate">
                    {lyrics?.lines && activeLineIndex >= 0 && lyrics.lines[activeLineIndex]
                      ? lyrics.lines[activeLineIndex].text
                      : 'Нажмите, чтобы открыть караоке-текст'}
                  </p>
                </div>
                <Maximize2 size={18} className="text-muted shrink-0" />
              </button>
            </main>

            {/* Thumb-Zone Controls & Waveform Scrubber */}
            <footer className="relative z-10 flex flex-col gap-gutter-lg shrink-0">
              {/* Dynamic Waveform Progress */}
              <div className="flex flex-col gap-gutter-xs">
                <div
                  ref={scrubberRef}
                  onMouseDown={handleScrubberMouseDown}
                  onTouchStart={handleScrubberTouchStart}
                  onTouchMove={handleScrubberTouchMove}
                  onTouchEnd={handleScrubberTouchEnd}
                  className="flex items-center justify-between gap-gutter-xs h-7 px-gutter-xs cursor-pointer"
                  aria-label="Прогресс трека"
                >
                  {Array.from({ length: 22 }).map((_, i) => {
                    const barPercent = (i / 21) * 100;
                    const isPassed = displayedPercent >= barPercent;
                    const heights = [12, 20, 16, 28, 20, 24, 12, 24, 16, 28, 20, 12, 24, 16, 20, 12, 24, 16, 20, 24, 16, 8];
                    const height = heights[i % heights.length];
                    return (
                      <span
                        key={i}
                        className={`w-1 rounded-full transition-colors duration-100 ${
                          isPassed
                            ? 'bg-accent'
                            : 'bg-dark-surface-container-highest'
                        }`}
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-mono-sm text-muted tabular-nums">
                    {formatDuration(currentTime * 1000)}
                  </span>
                  <span className="font-mono text-mono-sm text-muted tabular-nums">
                    {formatDuration(duration * 1000)}
                  </span>
                </div>
              </div>

              {/* Primary Transport */}
              <div className="flex items-center justify-between gap-gutter-md">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  aria-label="Перемешать"
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                    shuffle ? 'text-accent' : 'text-muted hover:text-dark-on-surface'
                  }`}
                >
                  <Shuffle size={20} />
                </button>

                <button
                  type="button"
                  onClick={playPrev}
                  aria-label="Предыдущий трек"
                  className="w-12 h-12 rounded-full flex items-center justify-center text-dark-on-surface active:scale-95 transition-transform duration-state-change"
                >
                  <SkipBack size={26} />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                  className="w-20 h-14 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center shadow-xl active:scale-95 transition-transform duration-state-change"
                >
                  {isPlaying ? (
                    <Pause size={28} fill="currentColor" />
                  ) : (
                    <Play size={28} fill="currentColor" className="ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  aria-label="Следующий трек"
                  className="w-12 h-12 rounded-full flex items-center justify-center text-dark-on-surface active:scale-95 transition-transform duration-state-change"
                >
                  <SkipForward size={26} />
                </button>

                <button
                  type="button"
                  onClick={toggleRepeat}
                  aria-label="Повтор"
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                    repeat !== 'off' ? 'text-accent' : 'text-muted hover:text-dark-on-surface'
                  }`}
                >
                  <Repeat size={20} />
                </button>
              </div>

              {/* Thumb-Reachable Utility Strip */}
              <div className="grid grid-cols-4 gap-gutter-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (currentTrack) {
                      usePlayerStore.getState().startEntityWave('track', currentTrack.id);
                    }
                  }}
                  className="flex flex-col items-center gap-gutter-xs py-gutter-sm rounded-lg bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container active:scale-95 transition-all"
                >
                  <Radio size={18} className="text-accent" />
                  <span className="font-label text-label-sm">Похожие</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab('lyrics')}
                  className="flex flex-col items-center gap-gutter-xs py-gutter-sm rounded-lg bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container active:scale-95 transition-all"
                >
                  <Mic2 size={18} />
                  <span className="font-label text-label-sm">Текст</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEqOpen(true)}
                  className="flex flex-col items-center gap-gutter-xs py-gutter-sm rounded-lg bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container active:scale-95 transition-all"
                >
                  <Sliders size={18} />
                  <span className="font-label text-label-sm">Звук</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab('queue')}
                  className="flex flex-col items-center gap-gutter-xs py-gutter-sm rounded-lg bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container active:scale-95 transition-all"
                >
                  <ListMusic size={18} />
                  <span className="font-label text-label-sm">Очередь</span>
                </button>
              </div>
            </footer>
          </div>
        )
      ) : (
        <>
          {/* DESKTOP TOP HEADER */}
          <div
            style={{
              height: 54,
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10,
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(20px)',
              backgroundColor: 'rgba(10, 10, 10, 0.4)',
            }}
          >
            <button
              onClick={() => setNowPlayingOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ChevronDown size={18} />
              <span>Свернуть</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#a3021a',
                  boxShadow: '0 0 10px #a3021a',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.7)',
                  letterSpacing: '0.04em',
                }}
              >
                {waveMode ? 'МОЯ ВОЛНА' : 'СЕЙЧАС ИГРАЕТ'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setEqOpen(true)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Эквалайзер"
              >
                <Sliders size={15} />
              </button>

              {isTauri() && (
                <button
                  onClick={async () => {
                    setNowPlayingOpen(false);
                    await invoke('cmd_show_mini_player').catch(() => {});
                  }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Мини-плеер"
                >
                  <Minimize2 size={15} />
                </button>
              )}
            </div>
          </div>
        /* DESKTOP 2-COLUMN VIEW */
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 420px) minmax(340px, 1fr)',
            gap: 40,
            padding: '24px 50px 32px',
            zIndex: 10,
            overflow: 'hidden',
            maxWidth: 1300,
            margin: '0 auto',
            width: '100%',
            alignItems: 'center',
          }}
        >
          {/* LEFT COLUMN: Artwork + Meta + Transport Controls */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              justifyContent: 'center',
            }}
          >
            {/* Album Cover Card */}
            <div
              style={{
                width: 'min(280px, 32vh)',
                aspectRatio: '1',
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#121212',
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.75)',
                position: 'relative',
                marginBottom: 20,
                flexShrink: 0,
              }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Disc size={56} color="#444" />
                </div>
              )}
            </div>

            {/* Track Meta & Like */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ overflow: 'hidden', minWidth: 0, flex: 1, marginRight: 12 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 3,
                  }}
                  title={currentTrack?.title}
                >
                  {currentTrack?.title || 'Музыка не воспроизводится'}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.65)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentTrack?.artists.join(', ') || 'Выберите трек'}
                </div>
              </div>

              {currentTrack && (
                <button
                  onClick={() => toggleLike(currentTrack)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 6,
                    color: trackLiked ? '#a3021a' : '#888888',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'transform 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  title={trackLiked ? 'В любимых' : 'Добавить в любимые'}
                >
                  <Heart
                    size={22}
                    fill={trackLiked ? '#a3021a' : 'transparent'}
                    color={trackLiked ? '#a3021a' : 'currentColor'}
                  />
                </button>
              )}
            </div>

            {/* Scrubber Progress Bar */}
            <div style={{ width: '100%', marginBottom: 16 }}>
              <div
                ref={scrubberRef}
                onMouseDown={handleScrubberMouseDown}
                style={{
                  width: '100%',
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${displayedPercent}%`,
                      height: '100%',
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                <span>{formatDuration(currentTime * 1000)}</span>
                <span>{formatDuration(duration * 1000)}</span>
              </div>
            </div>

            {/* Primary Transport Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <button
                onClick={toggleShuffle}
                style={{
                  background: 'none',
                  border: 'none',
                  color: shuffle ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Перемешать"
              >
                <Shuffle size={16} />
              </button>

              <button
                onClick={playPrev}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Предыдущий трек"
              >
                <SkipBack size={22} />
              </button>

              {/* Play/Pause Button */}
              <button
                onClick={togglePlay}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(255, 255, 255, 0.25)',
                  transition: 'transform 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                title={isPlaying ? 'Пауза' : 'Воспроизведение'}
              >
                {isPlaying ? (
                  <div style={{ display: 'flex', gap: 3 }}>
                    <div
                      style={{
                        width: 3.5,
                        height: 16,
                        backgroundColor: '#000000',
                        borderRadius: 1,
                      }}
                    />
                    <div
                      style={{
                        width: 3.5,
                        height: 16,
                        backgroundColor: '#000000',
                        borderRadius: 1,
                      }}
                    />
                  </div>
                ) : (
                  <Play size={20} fill="#000000" style={{ marginLeft: 2 }} />
                )}
              </button>

              <button
                onClick={playNext}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Следующий трек"
              >
                <SkipForward size={22} />
              </button>

              <button
                onClick={toggleRepeat}
                style={{
                  background: 'none',
                  border: 'none',
                  color: repeat !== 'off' ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Повтор"
              >
                <Repeat size={16} />
              </button>
            </div>

            {/* Volume Slider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                maxWidth: 240,
              }}
            >
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#ffffff',
                  cursor: 'pointer',
                  height: 4,
                }}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Synchronized Karaoke Lyrics */}
          <div
            style={{
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              padding: '24px 32px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 18,
                flexShrink: 0,
              }}
            >
              <Mic2 size={15} color="#a3021a" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Текст песни</span>
            </div>

            <div
              ref={lyricsContainerRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                paddingRight: 8,
              }}
            >
              {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
                lyrics.lines.map((line, idx) => {
                  const isActive = idx === activeLineIndex;
                  const isPast = idx < activeLineIndex;
                  return (
                    <div
                      key={idx}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => {
                        if (line.time_ms !== undefined) seek(line.time_ms / 1000);
                      }}
                      style={{
                        cursor: 'pointer',
                        fontSize: isActive ? 22 : 16,
                        fontWeight: isActive ? 800 : 500,
                        color: isActive
                          ? '#ffffff'
                          : isPast
                          ? 'rgba(255, 255, 255, 0.45)'
                          : 'rgba(255, 255, 255, 0.22)',
                        lineHeight: 1.4,
                        transition: 'all 0.18s ease',
                        padding: '4px 8px',
                        borderRadius: 8,
                        backgroundColor: isActive ? 'rgba(163, 2, 26, 0.2)' : 'transparent',
                      }}
                    >
                      {line.text}
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'rgba(255, 255, 255, 0.4)',
                    textAlign: 'center',
                  }}
                >
                  <Mic2 size={32} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                    Текст пока не добавлен
                  </div>
                  <p style={{ fontSize: 13, maxWidth: 280, margin: 0 }}>
                    Для этой композиции синхронизированные караоке-строки отсутствуют.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
