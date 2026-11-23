import React, { useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Loader2, Radio } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useWindowStore } from '../../store/windowStore';
import { formatCoverUrl } from '../../types';
import { triggerHaptic } from '../../utils/haptics';

export function MobileMiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    togglePlay,
    playNext,
    playPrev,
    waveMode,
  } = usePlayerStore();

  const { setNowPlayingOpen } = useWindowStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const leftIndicatorRef = useRef<HTMLDivElement | null>(null);
  const rightIndicatorRef = useRef<HTMLDivElement | null>(null);

  // Gesture state tracking (zero React re-renders during drag!)
  const gestureState = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    isDragging: false,
    direction: null as 'horizontal' | 'vertical' | null,
    thresholdCrossed: false,
    recentTouches: [] as Array<{ x: number; y: number; t: number }>,
    rafId: 0,
  });

  // Track switch transition animation flag for visual slide-in
  const [transitionKey, setTransitionKey] = useState(0);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const artistsStr = currentTrack ? currentTrack.artists.join(', ') : '';
  const coverUrl = currentTrack?.cover_uri ? formatCoverUrl(currentTrack.cover_uri, '200x200') : null;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    // Safe edge check for iOS back gesture
    if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;

    const state = gestureState.current;
    const now = performance.now();
    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
    state.startTime = now;
    state.isDragging = false;
    state.direction = null;
    state.thresholdCrossed = false;
    state.recentTouches = [{ x: touch.clientX, y: touch.clientY, t: now }];

    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
      contentRef.current.style.willChange = 'transform';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = gestureState.current;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const now = performance.now();

    state.currentX = touch.clientX;
    state.currentY = touch.clientY;
    state.recentTouches.push({ x: touch.clientX, y: touch.clientY, t: now });
    if (state.recentTouches.length > 5) state.recentTouches.shift();

    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;

    // Direction locking after 8px
    if (state.direction === null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX > 8 || absY > 8) {
        state.isDragging = true;
        state.direction = absX > absY ? 'horizontal' : 'vertical';
      } else {
        return;
      }
    }

    if (!state.isDragging) return;

    // Handle Vertical Swipe Up (Pull to expand Now Playing)
    if (state.direction === 'vertical') {
      if (dy < 0) {
        // Dragging upwards
        const pullUpDist = Math.abs(dy);
        const pullProgress = Math.min(1, pullUpDist / 50);

        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(0, ${dy * 0.4}px, 0) scale(${1 + pullProgress * 0.02})`;
        }

        if (pullUpDist >= 45 && !state.thresholdCrossed) {
          state.thresholdCrossed = true;
          triggerHaptic('selection');
        } else if (pullUpDist < 45 && state.thresholdCrossed) {
          state.thresholdCrossed = false;
        }
      }
      return;
    }

    // Handle Horizontal Swipe (Track Switching)
    if (state.direction === 'horizontal') {
      // Rubber-banding formula
      const visualDx = Math.sign(dx) * Math.pow(Math.abs(dx), 0.82) * 1.8;
      const absDist = Math.abs(dx);
      const threshold = 65;

      // Threshold micro-haptic
      if (absDist >= threshold && !state.thresholdCrossed) {
        state.thresholdCrossed = true;
        triggerHaptic('selection');
      } else if (absDist < threshold && state.thresholdCrossed) {
        state.thresholdCrossed = false;
      }

      const progress = Math.min(1, absDist / threshold);

      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${visualDx}px, 0, 0)`;
        }

        // Update peek indicators
        if (leftIndicatorRef.current && rightIndicatorRef.current) {
          if (dx > 0) {
            // Dragging right -> reveal previous track indicator
            leftIndicatorRef.current.style.opacity = `${progress}`;
            leftIndicatorRef.current.style.transform = `translate3d(${Math.min(dx * 0.3, 16)}px, -50%, 0) scale(${0.8 + progress * 0.25})`;
            rightIndicatorRef.current.style.opacity = '0';
          } else {
            // Dragging left -> reveal next track indicator
            rightIndicatorRef.current.style.opacity = `${progress}`;
            rightIndicatorRef.current.style.transform = `translate3d(${Math.max(dx * 0.3, -16)}px, -50%, 0) scale(${0.8 + progress * 0.25})`;
            leftIndicatorRef.current.style.opacity = '0';
          }
        }
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const state = gestureState.current;
    if (state.rafId) cancelAnimationFrame(state.rafId);

    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 1. Check for pure Tap (< 6px movement)
    if (!state.isDragging && absDx < 6 && absDy < 6) {
      setNowPlayingOpen(true);
      return;
    }

    // 2. Compute velocity
    let vx = 0;
    let vy = 0;
    if (state.recentTouches.length >= 2) {
      const first = state.recentTouches[0];
      const last = state.recentTouches[state.recentTouches.length - 1];
      const dt = Math.max(1, last.t - first.t);
      vx = (last.x - first.x) / dt;
      vy = (last.y - first.y) / dt;
    }

    // 3. Handle Vertical Swipe Up commit
    if (state.direction === 'vertical') {
      if (containerRef.current) {
        containerRef.current.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';
        containerRef.current.style.transform = 'translate3d(0, 0, 0)';
      }

      if (dy < -40 || (vy < -0.45 && dy < -20)) {
        triggerHaptic('medium');
        setNowPlayingOpen(true);
      }
      state.isDragging = false;
      return;
    }

    // 4. Handle Horizontal Swipe commit
    if (state.direction === 'horizontal') {
      const isFlick = Math.abs(vx) > 0.45 && absDx > 25;
      const reachedThreshold = absDx >= 65;

      if (reachedThreshold || isFlick) {
        const goingNext = dx < 0 || (isFlick && vx < 0);
        triggerHaptic('light');

        if (contentRef.current) {
          // Slide out animation
          contentRef.current.style.transition = 'transform 0.18s cubic-bezier(0.3, 0, 0.8, 0.15), opacity 0.18s';
          contentRef.current.style.transform = `translate3d(${goingNext ? '-110%' : '110%'}, 0, 0)`;
          contentRef.current.style.opacity = '0';
        }

        setTimeout(() => {
          if (goingNext) {
            playNext();
          } else {
            playPrev();
          }

          setTransitionKey((k) => k + 1);

          // Prepare entrance from opposite side
          if (contentRef.current) {
            contentRef.current.style.transition = 'none';
            contentRef.current.style.transform = `translate3d(${goingNext ? '50%' : '-50%'}, 0, 0)`;
            contentRef.current.style.opacity = '0.4';

            // Spring into center
            requestAnimationFrame(() => {
              if (contentRef.current) {
                contentRef.current.style.transition = 'transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.15), opacity 0.24s';
                contentRef.current.style.transform = 'translate3d(0, 0, 0)';
                contentRef.current.style.opacity = '1';
              }
            });
          }
        }, 160);
      } else {
        // Snap back to center
        if (contentRef.current) {
          contentRef.current.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1)';
          contentRef.current.style.transform = 'translate3d(0, 0, 0)';
        }
      }

      // Hide indicators
      if (leftIndicatorRef.current) {
        leftIndicatorRef.current.style.transition = 'opacity 0.2s';
        leftIndicatorRef.current.style.opacity = '0';
      }
      if (rightIndicatorRef.current) {
        rightIndicatorRef.current.style.transition = 'opacity 0.2s';
        rightIndicatorRef.current.style.opacity = '0';
      }
    }

    state.isDragging = false;
  }, [playNext, playPrev, setNowPlayingOpen]);

  if (!currentTrack) return null;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative overflow-hidden rounded-xl bg-dark-surface-container-high/95 backdrop-blur-xl border border-dark-outline-variant px-gutter-md py-gutter-sm flex items-center justify-between gap-gutter-md shadow-2xl cursor-pointer select-none touch-pan-y"
      style={{ willChange: 'transform' }}
      aria-label="Мини-плеер: текущий трек (свайп вверх — открыть, свайп влево/вправо — переключить)"
    >
      {/* Background Revealed Indicator: Previous Track (Left) */}
      <div
        ref={leftIndicatorRef}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-accent opacity-0 z-0"
      >
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shadow-lg">
          <SkipBack size={16} className="text-accent" />
        </div>
        <span className="font-label text-[11px] font-semibold text-accent uppercase tracking-wider">
          Пред.
        </span>
      </div>

      {/* Background Revealed Indicator: Next Track (Right) */}
      <div
        ref={rightIndicatorRef}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-accent opacity-0 z-0"
      >
        <span className="font-label text-[11px] font-semibold text-accent uppercase tracking-wider">
          След.
        </span>
        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shadow-lg">
          <SkipForward size={16} className="text-accent" />
        </div>
      </div>

      {/* Swipable Track Link & Info Content */}
      <div
        ref={contentRef}
        key={transitionKey}
        className="relative z-10 flex items-center gap-gutter-md min-w-0 flex-1 pointer-events-none"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={currentTrack.title}
            className="w-11 h-11 rounded-md object-cover shrink-0 bg-dark-surface-container shadow-md border border-dark-outline-variant/40"
          />
        ) : (
          <div className="w-11 h-11 rounded-md bg-dark-surface-container flex items-center justify-center shrink-0 border border-dark-outline-variant/40 text-accent">
            <Radio size={20} />
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <span className="font-title text-label-lg text-dark-on-surface truncate font-semibold">
            {currentTrack.title}
          </span>
          <span className="font-body text-label-md text-muted truncate">
            {artistsStr} · {waveMode ? 'Моя Волна' : 'YM'}
          </span>
        </div>
      </div>

      {/* Transport Controls (Clickable without triggering player drag) */}
      <div
        className="relative z-20 flex items-center gap-gutter-xs shrink-0"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          className="w-9 h-9 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center active:scale-95 transition-transform duration-state-change shadow-md"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-dark-surface" />
          ) : isPlaying ? (
            <Pause size={17} fill="currentColor" />
          ) : (
            <Play size={17} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={playNext}
          aria-label="Следующий трек"
          className="w-9 h-9 rounded-full flex items-center justify-center text-dark-on-surface hover:text-accent active:scale-95 transition-transform duration-state-change"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Built-in 2px Progress Line */}
      <div className="absolute bottom-0 left-gutter-md right-gutter-md h-0.5 bg-dark-surface-container-highest rounded-full overflow-hidden pointer-events-none z-10">
        <div
          className="h-full bg-accent rounded-full transition-all duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
    </div>
  );
}

export default MobileMiniPlayer;
