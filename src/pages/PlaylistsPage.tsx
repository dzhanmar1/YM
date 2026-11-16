import { useEffect, useState } from 'react';
import { ArrowLeft, Play, ListMusic, Loader2, Disc } from 'lucide-react';
import * as api from '../api';
import { usePlayerStore } from '../store/playerStore';
import { TrackItemRow } from '../components/TrackItemRow';
import type { Playlist, TrackItem } from '../types';
import { formatCoverUrl } from '../types';

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const setQueue = usePlayerStore((s) => s.setQueue);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const list = await api.getUserPlaylists();
      setPlaylists(list);
    } catch (e) {
      console.error('Failed to load playlists:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setLoadingTracks(true);
    try {
      const tracks = await api.getPlaylistTracks(playlist.kind);
      setPlaylistTracks(tracks);
    } catch (e) {
      console.error('Failed to load playlist tracks:', e);
      setPlaylistTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  };

  // 1. Playlist Tracks Detail View
  if (selectedPlaylist) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Detail Header */}
        <div style={{
          padding: '28px 36px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSelectedPlaylist(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              marginBottom: 16,
              padding: 0,
            }}
          >
            <ArrowLeft size={14} />
            <span>Назад ко всем плейлистам</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}>
                {selectedPlaylist.cover_uri ? (
                  <img
                    src={formatCoverUrl(selectedPlaylist.cover_uri, '200x200')}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Disc size={32} color="var(--text-muted)" />
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Плейлист
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {selectedPlaylist.title}
                </h1>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  {selectedPlaylist.track_count} треков • {selectedPlaylist.owner_name || 'Вы'}
                </div>
              </div>
            </div>

            {playlistTracks.length > 0 && !loadingTracks && (
              <button
                onClick={() => setQueue(playlistTracks, 0)}
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
                }}
              >
                <Play size={15} fill="currentColor" />
                <span>Слушать</span>
              </button>
            )}
          </div>
        </div>

        {/* Tracks List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 36px' }}>
          {loadingTracks ? (
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
              <span style={{ fontSize: 12 }}>Загрузка треков плейлиста...</span>
            </div>
          ) : playlistTracks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              В этом плейлисте пока нет треков
            </div>
          ) : (
            <div>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {playlistTracks.map((track, i) => (
                  <TrackItemRow
                    key={track.id}
                    track={track}
                    index={i}
                    tracks={playlistTracks}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Playlists Grid View
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 40px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          Моя коллекция
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Ваши плейлисты и персональные подборки
        </p>
      </div>

      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50%',
          gap: 12,
          color: 'var(--text-muted)',
        }}>
          <Loader2 size={24} className="animate-spin" />
          <span style={{ fontSize: 12 }}>Загрузка коллекции...</span>
        </div>
      ) : playlists.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50%',
          gap: 12,
          color: 'var(--text-muted)',
        }}>
          <ListMusic size={36} strokeWidth={1} />
          <span style={{ fontSize: 13 }}>У вас пока нет созданных плейлистов</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
        }}>
          {playlists.map((playlist) => (
            <div
              key={playlist.kind}
              onClick={() => handleSelectPlaylist(playlist)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                backgroundColor: '#161616',
                marginBottom: 12,
                border: '1px solid var(--border-subtle)',
              }}>
                {playlist.cover_uri ? (
                  <img
                    src={formatCoverUrl(playlist.cover_uri, '200x200')}
                    alt={playlist.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Disc size={32} color="var(--text-muted)" />
                  </div>
                )}
              </div>

              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {playlist.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                {playlist.track_count} треков
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
