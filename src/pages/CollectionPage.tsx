import React, { useEffect, useState } from 'react';
import { Play, Heart, ListMusic, Loader2, Shuffle, ArrowLeft, Disc } from 'lucide-react';
import * as api from '../api';
import { usePlayerStore } from '../store/playerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { TrackItemRow } from '../components/TrackItemRow';
import type { Playlist, TrackItem } from '../types';
import { formatCoverUrl } from '../types';

export function CollectionPage() {
  const isMobile = useIsMobile();
  const [subTab, setSubTab] = useState<'liked' | 'playlists'>('liked');

  // Liked tracks state
  const [likedTracks, setLikedTracks] = useState<TrackItem[]>([]);
  const [loadingLiked, setLoadingLiked] = useState(true);

  // Playlists state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>([]);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const setLikedIds = usePlayerStore((s) => s.setLikedIds);
  const likedIds = usePlayerStore((s) => s.likedIds);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoadingLiked(true);
    setLoadingPlaylists(true);
    try {
      const [likedList, playlistsList] = await Promise.all([
        api.getLikedTracks().catch(() => []),
        api.getUserPlaylists().catch(() => []),
      ]);
      setLikedTracks(likedList);
      setLikedIds(likedList.map((t) => t.id));
      setPlaylists(playlistsList);
    } catch (e) {
      console.error('Failed to load collection:', e);
    } finally {
      setLoadingLiked(false);
      setLoadingPlaylists(false);
    }
  };

  const visibleLiked = likedTracks.filter((t) => likedIds.size === 0 || likedIds.has(t.id));

  const handleShuffleLiked = () => {
    if (visibleLiked.length === 0) return;
    const shuffled = [...visibleLiked].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
  };

  const handlePlayAllLiked = () => {
    if (visibleLiked.length === 0) return;
    setQueue(visibleLiked, 0);
  };

  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setLoadingPlaylistTracks(true);
    try {
      const tracks = await api.getPlaylistTracks(playlist.kind);
      setPlaylistTracks(tracks);
    } catch (e) {
      console.error('Failed to load playlist tracks:', e);
      setPlaylistTracks([]);
    } finally {
      setLoadingPlaylistTracks(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#050505',
      }}
    >
      {/* Top Header / Switcher */}
      <div
        style={{
          padding: isMobile ? '12px 14px' : '24px 32px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
          {!isMobile && (
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
              Моя коллекция
            </h1>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 8,
              padding: 3,
              marginLeft: isMobile ? 0 : 16,
              gap: 2,
            }}
          >
            <button
              onClick={() => {
                setSubTab('liked');
                setSelectedPlaylist(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: subTab === 'liked' ? '#ffffff' : 'transparent',
                color: subTab === 'liked' ? '#000000' : '#aaaaaa',
                fontSize: 12,
                fontWeight: subTab === 'liked' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Heart size={13} fill={subTab === 'liked' ? '#000000' : 'transparent'} />
              <span>Любимые треки</span>
              <span style={{ opacity: 0.6, fontSize: 11 }}>({visibleLiked.length})</span>
            </button>

            <button
              onClick={() => {
                setSubTab('playlists');
                setSelectedPlaylist(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: subTab === 'playlists' ? '#ffffff' : 'transparent',
                color: subTab === 'playlists' ? '#000000' : '#aaaaaa',
                fontSize: 12,
                fontWeight: subTab === 'playlists' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ListMusic size={13} />
              <span>Плейлисты</span>
              <span style={{ opacity: 0.6, fontSize: 11 }}>({playlists.length})</span>
            </button>
          </div>
        </div>

        {/* Action Buttons for Liked Tab */}
        {subTab === 'liked' && visibleLiked.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleShuffleLiked}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            >
              <Shuffle size={14} />
              <span>Перемешать</span>
            </button>

            <button
              onClick={handlePlayAllLiked}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                borderRadius: 8,
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Play size={14} fill="#000000" />
              <span>Слушать всё</span>
            </button>
          </div>
        )}
      </div>

      {/* BODY VIEWPORT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 10px 140px' : '16px 32px 32px' }}>
        {/* ── 1. LIKED TRACKS VIEW ────────────────────────────────────── */}
        {subTab === 'liked' && (
          <div>
            {loadingLiked ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
                <Loader2 size={24} className="animate-spin" color="#ffffff" />
                <span style={{ fontSize: 13, color: '#888888' }}>Загрузка любимых треков...</span>
              </div>
            ) : visibleLiked.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666666' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Heart size={24} color="#666666" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  Список любимых треков пуст
                </div>
                <p style={{ fontSize: 13, color: '#888888', maxWidth: 360, margin: '0 auto' }}>
                  Нажимайте на сердечко у понравившихся треков в Моей Волне или на главной, и они появятся здесь.
                </p>
              </div>
            ) : (
              <div>
                {visibleLiked.map((track, index) => (
                  <TrackItemRow
                    key={`${track.id}-${index}`}
                    track={track}
                    index={index}
                    tracks={visibleLiked}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 2. PLAYLISTS VIEW ───────────────────────────────────────── */}
        {subTab === 'playlists' && (
          <div>
            {selectedPlaylist ? (
              <div>
                {/* Playlist Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                  <button
                    onClick={() => setSelectedPlaylist(null)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Назад к плейлистам"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: '#181818', flexShrink: 0 }}>
                    {selectedPlaylist.cover_uri ? (
                      <img src={formatCoverUrl(selectedPlaylist.cover_uri, '200x200')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Disc size={32} color="#555" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                      {selectedPlaylist.title}
                    </h2>
                    <div style={{ fontSize: 13, color: '#888888', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{playlistTracks.length} треков</span>
                      {selectedPlaylist.owner_name && <span>• {selectedPlaylist.owner_name}</span>}
                    </div>
                  </div>

                  {playlistTracks.length > 0 && (
                    <button
                      onClick={() => setQueue(playlistTracks, 0)}
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 20px',
                        borderRadius: 8,
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={15} fill="#000000" />
                      <span>Слушать</span>
                    </button>
                  )}
                </div>

                {/* Playlist Tracks List */}
                {loadingPlaylistTracks ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                    <Loader2 size={24} className="animate-spin" color="#ffffff" />
                  </div>
                ) : (
                  <div>
                    {playlistTracks.map((track, index) => (
                      <TrackItemRow
                        key={`${track.id}-${index}`}
                        track={track}
                        index={index}
                        tracks={playlistTracks}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {loadingPlaylists ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
                    <Loader2 size={24} className="animate-spin" color="#ffffff" />
                    <span style={{ fontSize: 13, color: '#888888' }}>Загрузка плейлистов...</span>
                  </div>
                ) : playlists.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666666' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <ListMusic size={24} color="#666666" />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                      Нет сохраненных плейлистов
                    </div>
                    <p style={{ fontSize: 13, color: '#888888', maxWidth: 360, margin: '0 auto' }}>
                      Здесь будут отображаться ваши личные плейлисты из Яндекс Музыки.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: isMobile ? 10 : 20,
                    }}
                  >
                    {playlists.map((playlist) => (
                      <div
                        key={playlist.kind}
                        onClick={() => handleSelectPlaylist(playlist)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: 10,
                          padding: 14,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            borderRadius: 8,
                            overflow: 'hidden',
                            backgroundColor: '#161616',
                            marginBottom: 12,
                            position: 'relative',
                          }}
                        >
                          {playlist.cover_uri ? (
                            <img
                              src={formatCoverUrl(playlist.cover_uri, '300x300')}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ListMusic size={32} color="#555" />
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                          {playlist.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#888888' }}>
                          {playlist.track_count} треков
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
