import { useState, memo } from 'react';
import { Play, Pause, Heart, Radio } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import type { TrackItem } from '../types';
import { formatCoverUrl, formatDuration } from '../types';

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

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, tracks, index);
    }
  };

  if (isMobile) {
    return (
      <div
        onClick={handlePlayClick}
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 36px 36px',
          alignItems: 'center',
          gap: 12,
          padding: '8px 10px',
          borderRadius: 12,
          backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
          marginBottom: 2,
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
