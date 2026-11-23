import React, { useRef, useEffect } from 'react';
import { Play, Pause, Disc, Radio, Shuffle, ArrowLeft, Volume2, Trash2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { formatCoverUrl, formatDuration } from '../../types';
import { useDraggableSheet } from '../../hooks/useDraggableSheet';

interface MobileQueueModalProps {
  onBackToPlayer: () => void;
}

export function MobileQueueModal({ onBackToPlayer }: MobileQueueModalProps) {
  const {
    queue,
    queueIndex,
    currentTrack,
    isPlaying,
    togglePlay,
    playTrack,
    toggleShuffle,
    shuffle,
    waveMode,
  } = usePlayerStore();

  const activeTrackRef = useRef<HTMLLIElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const { sheetRef } = useDraggableSheet({
    onDismiss: onBackToPlayer,
    scrollContainerRef,
    threshold: 90,
  });

  // Auto-scroll to active track in queue
  useEffect(() => {
    if (activeTrackRef.current) {
      activeTrackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [queueIndex]);

  return (
    <div
      ref={sheetRef}
      className="h-full w-full max-w-lg mx-auto flex flex-col justify-between relative overflow-hidden bg-dark-surface text-dark-on-surface antialiased select-none overscroll-contain"
      style={{ willChange: 'transform' }}
    >
      {/* Soft Ambient Glow */}
      <div className="pointer-events-none fixed top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-accent opacity-10 blur-3xl" />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-dark-surface/95 backdrop-blur-md px-page-margin pt-gutter-md pb-gutter-md flex flex-col gap-gutter-md border-b border-dark-outline-variant/30 shrink-0">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onBackToPlayer}
            aria-label="Вернуться к плееру"
            className="py-gutter-xs px-gutter-xl focus:outline-none"
          >
            <span className="block w-10 h-1 rounded-full bg-dark-outline-variant hover:bg-muted transition-colors" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-gutter-sm">
            <button
              type="button"
              onClick={onBackToPlayer}
              className="w-8 h-8 rounded-full bg-dark-surface-container-low border border-dark-outline-variant flex items-center justify-center text-muted hover:text-dark-on-surface transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-headline text-title-lg text-dark-on-surface">
              Очередь воспроизведения
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {waveMode && (
              <span className="inline-flex items-center gap-1 font-mono text-label-sm text-accent bg-accent/15 px-2 py-0.5 rounded-full border border-accent/30">
                <Radio size={12} />
                <span>Волна</span>
              </span>
            )}
            <span className="font-mono text-label-sm text-muted bg-dark-surface-container-low px-2 py-0.5 rounded-full border border-dark-outline-variant tabular-nums">
              {queue.length} треков
            </span>
          </div>
        </div>
      </header>

      {/* Queue Track List */}
      <main
        ref={scrollContainerRef}
        className="relative z-10 flex-1 px-page-margin py-gutter-md overflow-y-auto no-scrollbar"
      >
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted font-mono text-body-sm">
            Очередь пуста
          </div>
        ) : (
          <ul className="flex flex-col gap-gutter-xs pb-16">
            {queue.map((track, idx) => {
              const isCurrent = idx === queueIndex;
              const cover = track.cover_uri ? formatCoverUrl(track.cover_uri, '100x100') : null;

              return (
                <li
                  key={`${track.id}-${idx}`}
                  ref={isCurrent ? activeTrackRef : null}
                  onClick={() => playTrack(track, queue, idx, waveMode)}
                  className={`flex items-center justify-between gap-gutter-md p-gutter-sm rounded-xl cursor-pointer transition-all duration-state-change ${
                    isCurrent
                      ? 'bg-accent/15 border border-accent/40 text-dark-on-surface shadow-sm'
                      : 'hover:bg-dark-surface-container-low text-muted hover:text-dark-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-gutter-md min-w-0 flex-1">
                    <span
                      className={`font-mono text-label-sm w-5 text-center tabular-nums shrink-0 ${
                        isCurrent ? 'text-accent font-bold' : 'text-muted'
                      }`}
                    >
                      {isCurrent ? <Volume2 size={16} className="animate-pulse" /> : idx + 1}
                    </span>

                    {cover ? (
                      <img
                        src={cover}
                        alt={track.title}
                        className="w-11 h-11 rounded-md object-cover shrink-0 bg-dark-surface-container shadow-sm"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-md bg-dark-surface-container flex items-center justify-center shrink-0 text-muted">
                        <Disc size={20} />
                      </div>
                    )}

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-title text-title-md truncate ${
                          isCurrent ? 'text-dark-on-surface font-semibold' : 'text-dark-on-surface/90'
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
                    {formatDuration(track.duration_ms)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Floating Bottom Control Pill */}
      <footer className="sticky bottom-0 z-20 px-page-margin pb-[calc(20px+var(--sab,0px))] pt-gutter-md bg-gradient-to-t from-dark-surface via-dark-surface/95 to-transparent shrink-0">
        <div className="rounded-xl bg-dark-surface-container-high border border-dark-outline-variant p-gutter-md flex items-center justify-between gap-gutter-md shadow-xl">
          <button
            type="button"
            onClick={onBackToPlayer}
            className="inline-flex items-center gap-gutter-xs px-gutter-md py-gutter-sm rounded-full bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container transition-colors active:scale-95"
          >
            <Disc size={18} />
            <span className="font-label text-label-md">Плеер</span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            className="w-12 h-12 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center active:scale-95 transition-transform duration-state-change shadow-lg"
          >
            {isPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleShuffle}
            className={`inline-flex items-center gap-gutter-xs px-gutter-md py-gutter-sm rounded-full transition-all active:scale-95 ${
              shuffle
                ? 'bg-accent text-light-on-primary font-semibold shadow-md'
                : 'bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container'
            }`}
          >
            <Shuffle size={18} />
            <span className="font-label text-label-md">Микс</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
export default MobileQueueModal;
