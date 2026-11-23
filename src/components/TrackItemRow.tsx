import { useState, memo, useRef, useCallback } from 'react';
import { Play, Pause, Heart, Radio, ListPlus, Check } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import type { TrackItem } from '../types';
import { formatCoverUrl, formatDuration } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface TrackItemRowProps {
  track: TrackItem;
  index: number;
  tracks: TrackItem[];
}

export const TrackItemRow = memo(function TrackItemRow({ track, index, tracks }: TrackItemRowProps) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const isCurrent = usePlayerStore((s) => s.currentTrack?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying && s.currentTrack?.id === track.id);
  const liked = usePlayerStore((s) => s.likedIds.has(track.id));
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleLike = usePlayerStore((s) => s.toggleLike);
  const startEntityWave = usePlayerStore((s) => s.startEntityWave);
  const playNextInQueue = usePlayerStore((s) => s.playNextInQueue);

  const handlePlayClick = useCallback(() => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, tracks, index);
    }
  }, [isCurrent, togglePlay, playTrack, track, tracks, index]);

  const rowContentRef = useRef<HTMLDivElement | null>(null);
  const leftActionRef = useRef<HTMLDivElement | null>(null);
  const rightActionRef = useRef<HTMLDivElement | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const rowGesture = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    direction: null as 'horizontal' | 'vertical' | null,
    thresholdCrossed: false,
    recentTouches: [] as Array<{ x: number; t: number }>,
    rafId: 0,
  });

  const handleRowTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (touch.clientX < 24) return;

    const now = performance.now();
    const state = rowGesture.current;
    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
    state.isDragging = false;
    state.direction = null;
    state.thresholdCrossed = false;
    state.recentTouches = [{ x: touch.clientX, t: now }];

    if (rowContentRef.current) {
      rowContentRef.current.style.transition = 'none';
      rowContentRef.current.style.willChange = 'transform';
    }
  }, []);

  const handleRowTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const state = rowGesture.current;
    state.currentY = touch.clientY;
    const now = performance.now();
    state.currentX = touch.clientX;
    state.recentTouches.push({ x: touch.clientX, t: now });
    if (state.recentTouches.length > 5) state.recentTouches.shift();

    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;

    // Strict direction lock after 8px
    if (state.direction === null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX > 8 || absY > 8) {
        state.direction = absX > absY ? 'horizontal' : 'vertical';
        state.isDragging = state.direction === 'horizontal';
      } else {
        return;
      }
    }

    if (!state.isDragging || state.direction !== 'horizontal') return;

    if (e.cancelable) e.preventDefault();

    const visualDx = Math.sign(dx) * Math.pow(Math.abs(dx), 0.85) * 1.5;
    const absDist = Math.abs(dx);
    const threshold = 68;

    if (absDist >= threshold && !state.thresholdCrossed) {
      state.thresholdCrossed = true;
      triggerHaptic('selection');
    } else if (absDist < threshold && state.thresholdCrossed) {
      state.thresholdCrossed = false;
    }

    const progress = Math.min(1, absDist / threshold);

    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(() => {
      if (rowContentRef.current) {
        rowContentRef.current.style.transform = `translate3d(${visualDx}px, 0, 0)`;
      }

      if (dx > 0) {
        if (leftActionRef.current) {
          leftActionRef.current.style.opacity = `${progress}`;
          leftActionRef.current.style.transform = `scale(${0.8 + progress * 0.25})`;
        }
        if (rightActionRef.current) rightActionRef.current.style.opacity = '0';
      } else {
        if (rightActionRef.current) {
          rightActionRef.current.style.opacity = `${progress}`;
          rightActionRef.current.style.transform = `scale(${0.8 + progress * 0.25})`;
        }
        if (leftActionRef.current) leftActionRef.current.style.opacity = '0';
      }
    });
  }, []);

  const handleRowTouchEnd = useCallback(() => {
    const state = rowGesture.current;
    if (state.rafId) cancelAnimationFrame(state.rafId);

    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 1. Check for pure Tap (< 6px movement)
    if (!state.isDragging && absDx < 6 && absDy < 6) {
      handlePlayClick();
      return;
    }

    if (!state.isDragging) return;
    state.isDragging = false;

    let vx = 0;
    if (state.recentTouches.length >= 2) {
      const first = state.recentTouches[0];
      const last = state.recentTouches[state.recentTouches.length - 1];
      const dt = Math.max(1, last.t - first.t);
      vx = (last.x - first.x) / dt;
    }

    const isFlick = Math.abs(vx) > 0.45 && absDx > 25;
    const reachedThreshold = absDx >= 68;

    if (reachedThreshold || isFlick) {
      if (dx > 0) {
        // Swipe Right: Play Next in Queue
        triggerHaptic('success');
        playNextInQueue(track);
        setFlashMessage('Следующим в очереди');
        setTimeout(() => setFlashMessage(null), 1400);
      } else {
        // Swipe Left: Toggle Like
        triggerHaptic('light');
        toggleLike(track);
        setFlashMessage(liked ? 'Удалено из любимых' : 'Добавлено в любимые');
        setTimeout(() => setFlashMessage(null), 1400);
      }
    }

    // Spring back to center
    if (rowContentRef.current) {
      rowContentRef.current.style.transition = 'transform 0.24s cubic-bezier(0.18, 0.89, 0.32, 1.15)';
      rowContentRef.current.style.transform = 'translate3d(0, 0, 0)';
    }

    if (leftActionRef.current) {
      leftActionRef.current.style.transition = 'opacity 0.2s';
      leftActionRef.current.style.opacity = '0';
    }
    if (rightActionRef.current) {
      rightActionRef.current.style.transition = 'opacity 0.2s';
      rightActionRef.current.style.opacity = '0';
    }
  }, [handlePlayClick, liked, playNextInQueue, toggleLike, track]);

  if (isMobile) {
    return (
      <div className="relative overflow-hidden rounded-xl mb-1 select-none">
        {/* Swipe Right Action Background: Play Next in Queue */}
        <div
          ref={leftActionRef}
          className="absolute inset-y-0 left-0 pl-3 flex items-center gap-1.5 text-accent opacity-0 pointer-events-none z-0"
        >
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shadow-lg">
            <ListPlus size={16} className="text-accent" />
          </div>
          <span className="font-label text-[11px] font-semibold text-accent uppercase tracking-wider">
            В очередь
          </span>
        </div>

        {/* Swipe Left Action Background: Like / Dislike */}
        <div
          ref={rightActionRef}
          className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 text-accent opacity-0 pointer-events-none z-0"
        >
          <span className="font-label text-[11px] font-semibold text-accent uppercase tracking-wider">
            {liked ? 'Убрать' : 'Любимое'}
          </span>
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shadow-lg">
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} className="text-accent" />
          </div>
        </div>

        {/* Temporary Feedback Toast */}
        {flashMessage && (
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 z-20 py-1 px-3 rounded-lg bg-dark-surface-container-highest/95 border border-accent/40 text-center font-label text-label-sm text-accent shadow-xl animate-fade-in flex items-center justify-center gap-1.5 pointer-events-none">
            <Check size={14} />
            <span>{flashMessage}</span>
          </div>
        )}

        {/* Foreground Swipable Card */}
        <div
          ref={rowContentRef}
          onTouchStart={handleRowTouchStart}
          onTouchMove={handleRowTouchMove}
          onTouchEnd={handleRowTouchEnd}
          onTouchCancel={handleRowTouchEnd}
          className="relative z-10 touch-pan-y"
          style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 36px 36px',
            alignItems: 'center',
            gap: 12,
            padding: '8px 10px',
            borderRadius: 12,
            backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.08)' : 'rgba(24, 27, 36, 0.4)',
            border: isCurrent ? '1px solid rgba(255, 59, 92, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {/* Mobile Cover with Playing Indicator */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#181818',
              position: 'relative',
              flexShrink: 0,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {track.cover_uri ? (
              <img
                src={formatCoverUrl(track.cover_uri, '100x100')}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a1a' }} />
            )}

            {isCurrent && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isPlaying ? (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                    <div className="eq-bar-1" style={{ width: 2.5, backgroundColor: '#ffffff', borderRadius: 1 }} />
                    <div className="eq-bar-2" style={{ width: 2.5, backgroundColor: '#ffffff', borderRadius: 1 }} />
                    <div className="eq-bar-3" style={{ width: 2.5, backgroundColor: '#ffffff', borderRadius: 1 }} />
                  </div>
                ) : (
                  <Play size={16} fill="#ffffff" color="#ffffff" />
                )}
              </div>
            )}
          </div>

          {/* Title & Artist */}
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? '#ffffff' : '#f0f0f0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: -0.2,
              }}
            >
              {track.title}
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
              {track.artists.join(', ') || 'Исполнитель'}
            </div>
          </div>

          {/* Wave by Track Button */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              startEntityWave('track', track.id);
            }}
          >
            <button
              type="button"
              title="Волна по треку"
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                color: '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Radio size={16} />
            </button>
          </div>

          {/* Like Button */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(track);
            }}
          >
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                color: liked ? '#ff3b30' : '#666666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={17} fill={liked ? '#ff3b30' : 'none'} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 40px 1fr 1fr 30px 30px 54px',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isHovered ? 'var(--bg-card-hover)' : 'transparent',
        transition: 'background-color 0.12s',
        cursor: 'default',
      }}
    >
      {/* Index / Play / Equalizer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        {isHovered ? (
          <button
            onClick={handlePlayClick}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {isCurrent && isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
          </button>
        ) : isCurrent && isPlaying ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
            <div className="eq-bar-1" style={{ width: 2, backgroundColor: '#ffffff', borderRadius: 1 }} />
            <div className="eq-bar-2" style={{ width: 2, backgroundColor: '#ffffff', borderRadius: 1 }} />
            <div className="eq-bar-3" style={{ width: 2, backgroundColor: '#ffffff', borderRadius: 1 }} />
          </div>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      {/* Cover */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        backgroundColor: '#161616',
        flexShrink: 0,
        border: '1px solid var(--border-subtle)',
      }}>
        {track.cover_uri ? (
          <img
            src={formatCoverUrl(track.cover_uri, '100x100')}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a1a' }} />
        )}
      </div>

      {/* Title & Artist */}
      <div style={{ overflow: 'hidden', paddingRight: 8 }}>
        <div
          onClick={handlePlayClick}
          style={{
            fontSize: 13,
            fontWeight: isCurrent ? 700 : 500,
            color: isCurrent ? 'var(--text-primary)' : '#e0e0e0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'pointer',
          }}
        >
          {track.title}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: 2,
        }}>
          {track.artists.join(', ') || 'Исполнитель'}
        </div>
      </div>

      {/* Album Title */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {track.album_title || '—'}
      </div>

      {/* Wave by Track Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            startEntityWave('track', track.id);
          }}
          title="Запустить Мою Волну по этому треку"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Radio size={14} />
        </button>
      </div>

      {/* Like Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={() => toggleLike(track)}
          title={liked ? 'Удалить из любимых' : 'Добавить в любимые'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: liked ? '#ffffff' : 'var(--text-muted)',
            opacity: liked || isHovered ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        >
          <Heart size={15} fill={liked ? '#ffffff' : 'transparent'} strokeWidth={liked ? 0 : 2} />
        </button>
      </div>

      {/* Duration */}
      <div style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'right',
      }}>
        {formatDuration(track.duration_ms)}
      </div>
    </div>
  );
});
