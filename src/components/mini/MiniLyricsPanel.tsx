import React, { useRef, useEffect } from 'react';
import { X, Play, Pause } from 'lucide-react';
import { formatDuration } from '../../types';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface LyricsData {
  lines: Array<{ time_ms: number; text: string }>;
}

interface MiniLyricsPanelProps {
  lyrics: LyricsData | null;
  activeLineIndex: number;
  isPlaying: boolean;
  titleDisplay: string;
  currentTime: number;
  duration: number;
  onClose: () => void;
  onTogglePlay: () => void;
  sendAction: (action: string, payload?: any) => void;
}

export function MiniLyricsPanel({
  lyrics,
  activeLineIndex,
  isPlaying,
  titleDisplay,
  currentTime,
  duration,
  onClose,
  onTogglePlay,
  sendAction,
}: MiniLyricsPanelProps) {
  const activeLyricRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  const handleDrag = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.mp-nodrag, button, input')) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  return (
    <div className="mp-expanded-view">
      {/* Header */}
      <div className="mp-panel-header mp-drag" data-tauri-drag-region onMouseDown={handleDrag}>
        <span>СИНХРОННЫЙ ТЕКСТ ПЕСНИ</span>
        <button
          className="mp-panel-close mp-nodrag"
          onClick={onClose}
          title="Закрыть"
        >
          <X size={12} />
        </button>
      </div>

      {/* Lyrics Stream */}
      <div className="mp-lyrics-body mp-nodrag">
        {lyrics?.lines && lyrics.lines.length > 0 ? (
          lyrics.lines.map((line, idx) => {
            const isActive = idx === activeLineIndex;
            const isPast = idx < activeLineIndex;
            return (
              <div
                key={idx}
                ref={isActive ? activeLyricRef : null}
                className={`mp-lyric-line ${isActive ? 'mp-lyric-active' : isPast ? 'mp-lyric-prev' : ''}`}
                onClick={() => sendAction('seek', line.time_ms / 1000)}
              >
                {line.text}
              </div>
            );
          })
        ) : (
          <div style={{ color: '#555', padding: '30px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            ТЕКСТ ДЛЯ ЭТОГО ТРЕКА НЕ НАЙДЕН
          </div>
        )}
      </div>

      {/* Sleek Minimal Footer */}
      <div className="mp-panel-footer mp-nodrag">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="mp-panel-footer-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? (
              <Pause size={10} fill="#ffffff" color="#ffffff" />
            ) : (
              <Play size={10} fill="#ffffff" color="#ffffff" />
            )}
          </button>
          <span style={{ color: '#aaa', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titleDisplay}
          </span>
        </div>
        <span>{formatDuration(currentTime * 1000)} / {formatDuration(duration * 1000)}</span>
      </div>
    </div>
  );
}
