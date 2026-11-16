import { useEffect, useRef } from 'react';
import { X, Mic2, Loader2 } from 'lucide-react';
import { useLyricsStore } from '../store/lyricsStore';
import { usePlayerStore } from '../store/playerStore';

export function LyricsKaraoke() {
  const { lyrics, isLoading, error, isKaraokeOpen, activeLineIndex, setKaraokeOpen } = useLyricsStore();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const seek = usePlayerStore((s) => s.seek);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  if (!isKaraokeOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 74, // Above PlayerBar
      width: 420,
      backgroundColor: 'rgba(8, 8, 8, 0.96)',
      backdropFilter: 'blur(24px)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      boxShadow: '-10px 0 30px rgba(0,0,0,0.7)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 22px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mic2 size={16} color="var(--text-primary)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {lyrics?.is_synced ? 'Караоке (Синхронно)' : 'Текст песни'}
          </span>
        </div>

        <button
          onClick={() => setKaraokeOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Lyrics body */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {isLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            gap: 12,
          }}>
            <Loader2 size={24} className="animate-spin" />
            <span style={{ fontSize: 12 }}>Загрузка текста...</span>
          </div>
        )}

        {!isLoading && error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {!isLoading && !error && lyrics && lyrics.is_synced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {lyrics.lines.map((line, idx) => {
              const isActive = idx === activeLineIndex;

              return (
                <div
                  key={`${line.time_ms}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.time_ms / 1000)}
                  style={{
                    fontSize: isActive ? 20 : 15,
                    fontWeight: isActive ? 800 : 500,
                    color: isActive ? '#ffffff' : '#555555',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    lineHeight: 1.4,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    transformOrigin: 'left center',
                    textShadow: isActive ? '0 0 20px rgba(255,255,255,0.4)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#999999';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = '#555555';
                  }}
                >
                  {line.text || '♪'}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !error && lyrics && !lyrics.is_synced && (
          <div style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}>
            {lyrics.raw_text}
          </div>
        )}
      </div>

      {/* Footer Track indicator */}
      {currentTrack && (
        <div style={{
          padding: '12px 22px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>{currentTrack.title}</span>
          <span>{lyrics?.is_synced ? 'Кликните на строку для перемотки' : ''}</span>
        </div>
      )}
    </div>
  );
}
