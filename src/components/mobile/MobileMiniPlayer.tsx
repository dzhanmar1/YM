import React, { useRef } from 'react';
import { Play, Pause, SkipForward, Loader2, Radio } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useWindowStore } from '../../store/windowStore';
import { formatCoverUrl } from '../../types';

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
  const touchStartXRef = useRef<number | null>(null);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const artistsStr = currentTrack.artists.join(', ');
  const coverUrl = currentTrack.cover_uri ? formatCoverUrl(currentTrack.cover_uri, '200x200') : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartXRef.current;
    if (diff < -50) {
      playNext();
    } else if (diff > 50) {
      playPrev();
    }
    touchStartXRef.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => setNowPlayingOpen(true)}
      className="relative overflow-hidden rounded-xl bg-dark-surface-container-high border border-dark-outline-variant px-gutter-md py-gutter-sm flex items-center justify-between gap-gutter-md shadow-xl cursor-pointer select-none transition-transform active:scale-[0.99]"
      aria-label="Мини-плеер: текущий трек"
    >
      {/* Track Link / Info */}
      <div className="flex items-center gap-gutter-md min-w-0 flex-1">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={currentTrack.title}
            className="w-11 h-11 rounded-md object-cover shrink-0 bg-dark-surface-container shadow-sm border border-dark-outline-variant/40"
          />
        ) : (
          <div className="w-11 h-11 rounded-md bg-dark-surface-container flex items-center justify-center shrink-0 border border-dark-outline-variant/40 text-accent">
            <Radio size={20} />
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <span className="font-title text-label-lg text-dark-on-surface truncate">
            {currentTrack.title}
          </span>
          <span className="font-body text-label-md text-muted truncate">
            {artistsStr} · {waveMode ? 'Моя Волна' : 'YM'}
          </span>
        </div>
      </div>

      {/* Primary Transport Controls */}
      <div
        className="flex items-center gap-gutter-xs shrink-0"
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
      <div className="absolute bottom-0 left-gutter-md right-gutter-md h-0.5 bg-dark-surface-container-highest rounded-full overflow-hidden pointer-events-none">
        <div
          className="h-full bg-accent rounded-full transition-all duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
    </div>
  );
}
export default MobileMiniPlayer;
