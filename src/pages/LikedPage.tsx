import { useEffect, useState } from 'react';
import { Play, Heart, Loader2, Shuffle } from 'lucide-react';
import * as api from '../api';
import { usePlayerStore } from '../store/playerStore';
import { TrackItemRow } from '../components/TrackItemRow';
import type { TrackItem } from '../types';

export function LikedPage() {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const setLikedIds = usePlayerStore((s) => s.setLikedIds);
  const likedIds = usePlayerStore((s) => s.likedIds);

  useEffect(() => {
    loadLiked();
  }, []);

  const loadLiked = async () => {
    setLoading(true);
    try {
      const list = await api.getLikedTracks();
      setTracks(list);
      setLikedIds(list.map((t) => t.id));
    } catch (e) {
      console.error('Failed to load liked tracks:', e);
    } finally {
      setLoading(false);
    }
  };

  // Reactively filter tracks based on playerStore likedIds
  const visibleTracks = tracks.filter((t) => likedIds.size === 0 || likedIds.has(t.id));

  const handleShufflePlay = () => {
    if (visibleTracks.length === 0) return;
    const shuffled = [...visibleTracks].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top Banner */}
      <div style={{
        padding: '32px 36px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#ffffff',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Heart size={32} fill="#000000" />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Плейлист
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
              Мне нравится
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {loading ? 'Загрузка...' : `${visibleTracks.length} треков`}
            </div>
          </div>
        </div>

        {visibleTracks.length > 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setQueue(visibleTracks, 0)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-inverted)',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              title="Воспроизвести по порядку"
            >
              <Play size={15} fill="currentColor" />
              <span>Слушать всё</span>
            </button>

            <button
              onClick={handleShufflePlay}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Перемешать и воспроизвести"
            >
              <Shuffle size={15} />
              <span>Перемешать</span>
            </button>
          </div>
        )}
      </div>

      {/* Track List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 36px' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60%',
            gap: 12,
            color: 'var(--text-muted)',
          }}>
            <Loader2 size={24} className="animate-spin" />
            <span style={{ fontSize: 12 }}>Загрузка любимых треков...</span>
          </div>
        ) : visibleTracks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60%',
            gap: 12,
            color: 'var(--text-muted)',
          }}>
            <Heart size={36} strokeWidth={1} />
            <span style={{ fontSize: 13 }}>У вас пока нет отмеченных треков</span>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '36px 40px 1fr 1fr 40px 60px',
              gap: 12,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 6,
            }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span />
              <span>Название</span>
              <span>Альбом</span>
              <span style={{ textAlign: 'center' }}>♥</span>
              <span style={{ textAlign: 'right' }}>Время</span>
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visibleTracks.map((track, i) => (
                <TrackItemRow
                  key={track.id}
                  track={track}
                  index={i}
                  tracks={visibleTracks}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
