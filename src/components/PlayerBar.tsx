import React, { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Heart,
  Radio,
  Sliders,
  ListMusic,
  Minimize2,
  Disc,
  ThumbsDown,
  Loader2,
  Mic2,
  Maximize2,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useWindowStore } from '../store/windowStore';
import { useEqualizerStore } from '../store/equalizerStore';
import { VolumeControl } from './VolumeControl';
import { formatCoverUrl, formatDuration } from '../types';

export function PlayerBar() {
  const { sideDrawer, setSideDrawer, setNowPlayingOpen } = useWindowStore();

  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    shuffle,
    repeat,
    togglePlay,
    playNext,
    playPrev,
    seek,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    isLiked,
    waveMode,
    dislikeWaveTrack,
  } = usePlayerStore();

  const trackLiked = currentTrack ? isLiked(currentTrack.id) : false;

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const calculateScrubRatio = useCallback((clientX: number) => {
    if (!scrubberRef.current) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

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

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayedPercent = isScrubbing && scrubPercent !== null ? scrubPercent : currentPercent;

  return (
    <footer
      style={{
        height: 76,
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 40,
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* LEFT: Current Track Info with Expandable Cover */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '30%',
          minWidth: 0,
        }}
      >
        {currentTrack ? (
          <>
            {/* Square Cover (clickable to open Now Playing) */}
            <div
              onClick={() => setNowPlayingOpen(true)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                backgroundColor: '#161616',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative',
                flexShrink: 0,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              className="playerbar-cover-hover"
              title="Развернуть плеер «Сейчас играет»"
            >
              {currentTrack.cover_uri ? (
                <img
                  src={formatCoverUrl(currentTrack.cover_uri, '200x200')}
                  alt={currentTrack.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Disc size={24} color="#666" />
                </div>
              )}
            </div>

            {/* Title & Artists */}
            <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <div
                onClick={() => setNowPlayingOpen(true)}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                }}
                title={currentTrack.title}
              >
                {currentTrack.title}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#888888',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 2,
                }}
              >
                {currentTrack.artists.join(', ') || 'Неизвестный исполнитель'}
              </div>
            </div>

            {/* Like Heart */}
            <button
              onClick={() => toggleLike(currentTrack)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                color: trackLiked ? '#ff3344' : '#888888',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'transform 0.12s ease',
              }}
              title={trackLiked ? 'В любимых' : 'Добавить в любимые'}
            >
              <Heart
                size={18}
                fill={trackLiked ? '#ff3344' : 'transparent'}
                color={trackLiked ? '#ff3344' : 'currentColor'}
              />
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#666666' }}>
            Включите трек или Мою Волну
          </div>
        )}
      </div>

      {/* CENTER: Transport Controls & Scrubber */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '40%',
          maxWidth: 520,
          gap: 6,
        }}
      >
        {/* Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={toggleShuffle}
            style={{
              background: 'none',
              border: 'none',
              color: shuffle ? '#ffffff' : '#555555',
              cursor: 'pointer',
              padding: 4,
            }}
            title="Перемешать"
          >
            <Shuffle size={15} />
          </button>

          <button
            onClick={playPrev}
            style={{
              background: 'none',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              padding: 4,
            }}
            title="Предыдущий трек"
          >
            <SkipBack size={18} />
          </button>

          {/* Clean White Circular Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentTrack ? 'pointer' : 'default',
              opacity: currentTrack ? 1 : 0.4,
              boxShadow: isPlaying ? '0 0 14px rgba(255, 255, 255, 0.4)' : 'none',
              transition: 'transform 0.1s ease',
            }}
            title={isLoading ? 'Буферизация...' : isPlaying ? 'Пауза' : 'Слушать'}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" color="#000000" />
            ) : isPlaying ? (
              <div style={{ display: 'flex', gap: 3 }}>
                <div style={{ width: 3, height: 12, backgroundColor: '#000000', borderRadius: 1 }} />
                <div style={{ width: 3, height: 12, backgroundColor: '#000000', borderRadius: 1 }} />
              </div>
            ) : (
              <Play size={16} fill="#000000" color="#000000" style={{ marginLeft: 2 }} />
            )}
          </button>

          <button
            onClick={playNext}
            style={{
              background: 'none',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              padding: 4,
            }}
            title="Следующий трек"
          >
            <SkipForward size={18} />
          </button>

          {/* Dislike button for Wave */}
          {waveMode && (
            <button
              onClick={dislikeWaveTrack}
              disabled={!currentTrack}
              style={{
                background: 'none',
                border: 'none',
                color: '#666666',
                cursor: currentTrack ? 'pointer' : 'default',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}
              title="Не нравится (убрать из Волны)"
            >
              <ThumbsDown size={14} />
            </button>
          )}

          <button
            onClick={toggleRepeat}
            style={{
              background: 'none',
              border: 'none',
              color: repeat !== 'off' ? '#ffffff' : '#555555',
              cursor: 'pointer',
              padding: 4,
            }}
            title={`Повтор: ${repeat}`}
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Scrubber Rail & Timecodes */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#777777', width: 34, textAlign: 'right', flexShrink: 0 }}>
            {formatDuration(currentTime * 1000)}
          </span>

          <div
            ref={scrubberRef}
            onMouseDown={handleScrubberMouseDown}
            style={{
              flex: 1,
              height: 14,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                height: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
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

          <span style={{ fontSize: 11, color: '#777777', width: 34, textAlign: 'left', flexShrink: 0 }}>
            {formatDuration(duration * 1000)}
          </span>
        </div>
      </div>

      {/* RIGHT: Slide-over Drawer Toggles & Volume */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          width: '30%',
        }}
      >
        {/* Synced Lyrics Drawer Toggle */}
        <button
          onClick={() => setSideDrawer(sideDrawer === 'lyrics' ? null : 'lyrics')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            backgroundColor: sideDrawer === 'lyrics' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            border: 'none',
            color: sideDrawer === 'lyrics' ? '#ffffff' : '#888888',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Открыть текст песни"
        >
          <Mic2 size={15} />
          <span>Текст</span>
        </button>

        {/* Queue Drawer Toggle */}
        <button
          onClick={() => setSideDrawer(sideDrawer === 'queue' ? null : 'queue')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            backgroundColor: sideDrawer === 'queue' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            border: 'none',
            color: sideDrawer === 'queue' ? '#ffffff' : '#888888',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Открыть очередь воспроизведения"
        >
          <ListMusic size={15} />
          <span>Очередь</span>
        </button>

        <div style={{ width: 1, height: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

        {/* Volume Slider */}
        <VolumeControl width={90} />
      </div>
    </footer>
  );
}
