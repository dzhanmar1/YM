import React, { useRef, useEffect } from 'react';
import { Disc } from 'lucide-react';
import type { SyncedLyrics } from '../../types';

interface StudioLyricsProps {
  lyrics: SyncedLyrics | null;
  activeLineIndex: number;
  currentTrack: any;
  onSeek: (timeSeconds: number) => void;
}

export function StudioLyrics({
  lyrics,
  activeLineIndex,
  currentTrack,
  onSeek,
}: StudioLyricsProps) {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '36px 36px 60px 36px',
        position: 'relative',
      }}
    >
      {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {lyrics.lines.map((line, idx) => {
            const isActive = idx === activeLineIndex;
            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  if (line.time_ms !== undefined) onSeek(line.time_ms / 1000);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {/* Active Line Marker */}
                <div
                  style={{
                    width: 3.5,
                    alignSelf: 'stretch',
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    boxShadow: isActive ? '0 0 10px rgba(255,255,255,0.7)' : 'none',
                    flexShrink: 0,
                    borderRadius: 1,
                  }}
                />

                <span
                  style={{
                    fontSize: isActive ? 'clamp(20px, 2vw, 26px)' : 'clamp(15px, 1.4vw, 18px)',
                    fontWeight: isActive ? 900 : 700,
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.22)',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    transform: isActive ? 'scale(1.02)' : 'none',
                    transformOrigin: 'left center',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {line.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#444444',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            textTransform: 'uppercase',
          }}
        >
          <Disc size={28} color="#333333" />
          <span>
            {currentTrack
              ? 'Инструментальная композиция или текст не найден'
              : 'Ожидание трека'}
          </span>
        </div>
      )}
    </div>
  );
}
