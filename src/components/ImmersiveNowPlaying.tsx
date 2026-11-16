import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
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
} from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { useEqualizerStore } from '../store/equalizerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { AmbientBackgroundVisualizer } from './AmbientBackgroundVisualizer';
import { formatCoverUrl, formatDuration } from '../types';
import { invoke } from '@tauri-apps/api/core';

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
  } = usePlayerStore();

  const { lyrics, activeLineIndex } = useLyricsStore();
  const { setModalOpen: setEqOpen } = useEqualizerStore();

  const [mobileTab, setMobileTab] = useState<'player' | 'lyrics'>('player');

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

      {/* TOP HEADER */}
      <div
        onTouchStart={handleHeaderTouchStart}
        onTouchEnd={handleHeaderTouchEnd}
        style={{
          height: isMobile ? 50 : 54,
          padding: isMobile ? '0 16px' : '0 24px',
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
        {/* Collapse Button */}
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

        {/* Center Mode / Switcher for Mobile */}
        {isMobile ? (
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              padding: 2,
            }}
          >
            <button
              onClick={() => setMobileTab('player')}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                border: 'none',
                backgroundColor: mobileTab === 'player' ? '#ffffff' : 'transparent',
                color: mobileTab === 'player' ? '#000000' : 'rgba(255, 255, 255, 0.6)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Трек
            </button>
            <button
              onClick={() => setMobileTab('lyrics')}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                border: 'none',
                backgroundColor: mobileTab === 'lyrics' ? '#ffffff' : 'transparent',
                color: mobileTab === 'lyrics' ? '#000000' : 'rgba(255, 255, 255, 0.6)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Текст
            </button>
          </div>
        ) : (
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
        )}

        {/* Right Tools: EQ, Mini (desktop only) */}
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

          {!isMobile && (
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

      {/* MOBILE CONTENT VIEW */}
      {isMobile ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 20px 24px',
            zIndex: 10,
            overflowY: 'auto',
          }}
        >
          {mobileTab === 'player' ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Big Album Artwork */}
              <div
                style={{
                  width: 'min(300px, 40vh)',
                  aspectRatio: '1',
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#141414',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)',
                  margin: 'auto auto 20px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
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
                    <Disc size={64} color="#444" />
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
                      fontSize: 19,
                      fontWeight: 800,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      letterSpacing: -0.3,
                    }}
                  >
                    {currentTrack?.title || 'Нет трека'}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'rgba(255, 255, 255, 0.65)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 2,
                    }}
                  >
                    {currentTrack?.artists.join(', ') || '—'}
                  </div>
                </div>

                {currentTrack && (
                  <button
                    onClick={() => toggleLike(currentTrack)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 8,
                      color: trackLiked ? '#ff3b30' : '#888888',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Heart size={24} fill={trackLiked ? '#ff3b30' : 'none'} />
                  </button>
                )}
              </div>

              {/* Scrubber Progress Bar */}
              <div style={{ width: '100%', marginBottom: 16 }}>
                <div
                  ref={scrubberRef}
                  onMouseDown={handleScrubberMouseDown}
                  onTouchStart={handleScrubberTouchStart}
                  onTouchMove={handleScrubberTouchMove}
                  onTouchEnd={handleScrubberTouchEnd}
                  style={{
                    width: '100%',
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 5,
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 3,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${displayedPercent}%`,
                        height: '100%',
                        backgroundColor: '#ffffff',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <span>{formatDuration(currentTime * 1000)}</span>
                  <span>{formatDuration(duration * 1000)}</span>
                </div>
              </div>

              {/* Transport Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0 8px',
                  marginBottom: 10,
                }}
              >
                <button
                  onClick={toggleShuffle}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: shuffle ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                    padding: 8,
                  }}
                >
                  <Shuffle size={20} />
                </button>

                <button
                  onClick={playPrev}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    padding: 8,
                  }}
                >
                  <SkipBack size={26} />
                </button>

                <button
                  onClick={togglePlay}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 20px rgba(255, 255, 255, 0.25)',
                  }}
                >
                  {isPlaying ? (
                    <Pause size={26} fill="#000000" />
                  ) : (
                    <Play size={26} fill="#000000" style={{ marginLeft: 3 }} />
                  )}
                </button>

                <button
                  onClick={playNext}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    padding: 8,
                  }}
                >
                  <SkipForward size={26} />
                </button>

                <button
                  onClick={toggleRepeat}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: repeat !== 'off' ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                    padding: 8,
                  }}
                >
                  <Repeat size={20} />
                </button>
              </div>
            </div>
          ) : (
            /* Mobile Karaoke Lyrics View */
            <div
              ref={lyricsContainerRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                padding: '16px 8px',
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
                        fontSize: isActive ? 22 : 17,
                        fontWeight: isActive ? 800 : 500,
                        color: isActive
                          ? '#ffffff'
                          : isPast
                          ? 'rgba(255, 255, 255, 0.45)'
                          : 'rgba(255, 255, 255, 0.22)',
                        lineHeight: 1.4,
                        transition: 'all 0.18s ease',
                        padding: '6px 8px',
                        borderRadius: 8,
                        backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
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
                  <Mic2 size={36} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                    Текст пока не добавлен
                  </div>
                  <p style={{ fontSize: 13, maxWidth: 280, margin: 0 }}>
                    Для этой композиции синхронизированные караоке-строки отсутствуют.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
