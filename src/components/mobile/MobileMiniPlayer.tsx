import React, { useRef } from 'react';
import { Play, Pause, SkipForward, Heart, Loader2 } from 'lucide-react';
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
    toggleLike,
    isLiked,
  } = usePlayerStore();

  const { setNowPlayingOpen } = useWindowStore();
  const touchStartXRef = useRef<number | null>(null);

  if (!currentTrack) return null;

  const trackLiked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const artistsStr = currentTrack.artists.join(', ');

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartXRef.current;
    if (diff < -50) {
      // Swiped left -> Next track
      playNext();
    } else if (diff > 50) {
      // Swiped right -> Previous track
      playPrev();
    }
    touchStartXRef.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 'calc(var(--mobile-bottom-nav-height) + var(--sab) + 8px)',
        height: 56,
        backgroundColor: '#161616',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        zIndex: 35,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
        userSelect: 'none',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onClick={() => setNowPlayingOpen(true)}
    >
      {/* Micro progress line at bottom of mini player */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, progressPercent))}%`,
            backgroundColor: '#ffffff',
            transition: 'width 0.2s linear',
          }}
        />
      </div>

      {/* Album Artwork */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#222222',
          flexShrink: 0,
          marginRight: 10,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {currentTrack.cover_uri ? (
          <img
            src={formatCoverUrl(currentTrack.cover_uri, '100x100')}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: '#666',
            }}
          >
            YM
          </div>
        )}
      </div>

      {/* Track Info (Title + Artist) */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginRight: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: -0.2,
          }}
        >
          {currentTrack.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#888888',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}
        >
          {artistsStr}
        </div>
      </div>

      {/* Action Controls */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Like Button */}
        <button
          type="button"
          onClick={() => toggleLike(currentTrack)}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: 'none',
            color: trackLiked ? '#ff3b30' : '#888888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Heart size={18} fill={trackLiked ? 'currentColor' : 'none'} />
        </button>

        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: 'none',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={17} fill="#000000" />
          ) : (
            <Play size={17} fill="#000000" style={{ marginLeft: 2 }} />
          )}
        </button>

        {/* Next Track Button */}
        <button
          type="button"
          onClick={playNext}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#cccccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
}
