import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Disc, Quote, Mic2, Radio, Check } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { formatCoverUrl } from '../types';
import { useDraggableSheet } from '../hooks/useDraggableSheet';

interface LyricsModalProps {
  onBackToPlayer?: () => void;
}

export function LyricsModal({ onBackToPlayer }: LyricsModalProps) {
  const { currentTrack, isPlaying, togglePlay, seek } = usePlayerStore();
  const { lyrics, activeLineIndex } = useLyricsStore();
  const [copied, setCopied] = useState(false);

  const activeLineRef = useRef<HTMLLIElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  const coverUrl = currentTrack?.cover_uri
    ? formatCoverUrl(currentTrack.cover_uri, '200x200')
    : null;

  const handleCopyQuote = () => {
    if (!lyrics?.lines || activeLineIndex < 0 || activeLineIndex >= lyrics.lines.length) {
      return;
    }
    const currentLine = lyrics.lines[activeLineIndex]?.text;
    if (!currentLine) return;

    const quoteText = `«${currentLine}» — ${currentTrack?.artists.join(', ')} (${currentTrack?.title})`;
    navigator.clipboard.writeText(quoteText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const { sheetRef } = useDraggableSheet({
    onDismiss: () => onBackToPlayer?.(),
    scrollContainerRef,
    threshold: 90,
  });

  return (
    <div
      ref={sheetRef}
      className="h-full w-full max-w-md mx-auto flex flex-col justify-between relative overflow-hidden bg-dark-surface text-dark-on-surface antialiased select-none overscroll-contain"
      style={{ willChange: 'transform' }}
    >
      {/* Soft Ambient Glow */}
      <div className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-accent opacity-10 blur-3xl" />

      {/* Minimal Context Header */}
      <header className="sticky top-0 z-20 bg-dark-surface/95 backdrop-blur-md px-page-margin pt-gutter-md pb-gutter-md flex flex-col gap-gutter-md border-b border-dark-outline-variant/30 shrink-0">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onBackToPlayer}
            aria-label="Вернуться к обложке"
            className="py-gutter-xs px-gutter-xl focus:outline-none"
          >
            <span className="block w-10 h-1 rounded-full bg-dark-outline-variant hover:bg-muted transition-colors" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-gutter-md rounded-full bg-dark-surface-container-low border border-dark-outline-variant p-gutter-xs pr-gutter-md">
          <div className="flex items-center gap-gutter-md min-w-0">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={currentTrack?.title || ''}
                className="w-10 h-10 rounded-full object-cover shrink-0 border border-dark-outline-variant/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-dark-surface-container flex items-center justify-center shrink-0 text-accent">
                <Disc size={20} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-title text-label-lg text-dark-on-surface truncate">
                {currentTrack?.title || 'Нет трека'}
              </span>
              <span className="font-body text-label-sm text-muted truncate">
                {currentTrack?.artists.join(', ') || '—'}
              </span>
            </div>
          </div>

          <Radio size={20} className="text-accent shrink-0 animate-pulse" />
        </div>
      </header>

      {/* Expressive Kinetic Lyrics Stream */}
      <main
        ref={scrollContainerRef}
        className="relative z-10 flex-1 px-page-margin py-gutter-xl overflow-y-auto no-scrollbar"
      >
        {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
          <ul className="flex flex-col gap-gutter-xl my-auto py-12">
            {lyrics.lines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              return (
                <li
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => {
                    if (line.time_ms !== undefined) seek(line.time_ms / 1000);
                  }}
                  className={`transition-all duration-state-change cursor-pointer ${
                    isActive ? 'py-gutter-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <p
                    className={
                      isActive
                        ? 'font-title text-display-lg-mobile text-dark-on-surface text-balance font-semibold tracking-tight'
                        : 'font-body text-headline-md text-muted/70 text-pretty font-normal'
                    }
                  >
                    {line.text}
                  </p>
                  {isActive && (
                    <span className="inline-block mt-gutter-sm w-16 h-1 rounded-full bg-accent shadow-[0_0_12px_rgba(255,59,92,0.6)]" />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 gap-gutter-md">
            <div className="w-16 h-16 rounded-full bg-dark-surface-container flex items-center justify-center text-muted">
              <Mic2 size={32} />
            </div>
            <div className="flex flex-col gap-gutter-xs max-w-xs">
              <h2 className="font-display text-title-lg text-dark-on-surface">
                Текст пока не добавлен
              </h2>
              <p className="font-body text-body-sm text-muted">
                Для этой композиции синхронизированные караоке-строки отсутствуют.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Thumb-Zone Floating Bottom Control Pill */}
      <footer className="sticky bottom-0 z-20 px-page-margin pb-[calc(20px+var(--sab,0px))] pt-gutter-md bg-gradient-to-t from-dark-surface via-dark-surface/95 to-transparent shrink-0">
        <div className="rounded-xl bg-dark-surface-container-high border border-dark-outline-variant p-gutter-md flex items-center justify-between gap-gutter-md shadow-xl">
          <button
            type="button"
            onClick={onBackToPlayer}
            className="inline-flex items-center gap-gutter-xs px-gutter-md py-gutter-sm rounded-full bg-dark-surface-container-low text-dark-on-surface hover:bg-dark-surface-container transition-colors active:scale-95"
          >
            <Disc size={18} />
            <span className="font-label text-label-md">Обложка</span>
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
            onClick={handleCopyQuote}
            className={`inline-flex items-center gap-gutter-xs px-gutter-md py-gutter-sm rounded-full bg-dark-surface-container-low transition-all active:scale-95 ${
              copied ? 'text-accent border border-accent/40' : 'text-dark-on-surface hover:bg-dark-surface-container'
            }`}
          >
            {copied ? <Check size={18} /> : <Quote size={18} className="text-accent" />}
            <span className="font-prosto text-label-md tracking-wide">{copied ? 'Скопировано!' : 'Цитата'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
export default LyricsModal;
