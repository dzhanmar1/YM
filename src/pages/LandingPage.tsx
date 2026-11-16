import { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  ArrowLeft,
  Flame,
  Sparkles,
  TrendingUp,
  Disc,
  Loader2,
  Radio,
  Clock,
  Compass,
  Sliders,
} from 'lucide-react';
import * as api from '../api';
import { usePlayerStore } from '../store/playerStore';
import { useWindowStore } from '../store/windowStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { TrackItemRow } from '../components/TrackItemRow';
import type { LandingData, PersonalPlaylist, TrackItem, ChartTrack } from '../types';
import { formatCoverUrl } from '../types';

export function LandingPage() {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PersonalPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'chart'>('overview');

  const { playTrack, setQueue, currentTrack, isPlaying, togglePlay, waveMode, startWave, startCustomWave } = usePlayerStore();
  const { setWaveSettingsOpen } = useWindowStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    loadLandingData();
  }, []);

  const loadLandingData = async () => {
    setLoading(true);
    try {
      const res = await api.getLanding();
      setData(res);
    } catch (err) {
      console.error('Failed to load landing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlaylist = async (playlist: PersonalPlaylist) => {
    setSelectedPlaylist(playlist);
    setLoadingTracks(true);
    try {
      const tracks = await api.getPlaylistTracks(playlist.kind, playlist.owner_login);
      setPlaylistTracks(tracks);
    } catch (err) {
      console.error('Failed to load personal playlist tracks:', err);
      setPlaylistTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleQuickPlayPlaylist = async (e: React.MouseEvent, playlist: PersonalPlaylist) => {
    e.stopPropagation();
    try {
      const tracks = await api.getPlaylistTracks(playlist.kind, playlist.owner_login);
      if (tracks.length > 0) {
        setQueue(tracks, 0);
      }
    } catch (err) {
      console.error('Failed to play playlist directly:', err);
    }
  };

  // 1. Detail View when a Personal Playlist is opened
  if (selectedPlaylist) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Detail Header */}
        <div
          style={{
            padding: isMobile ? '16px 16px 12px' : '28px 36px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
            backgroundColor: '#070707',
          }}
        >
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
            <span>Назад к рекомендациям</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 12,
                  overflow: 'hidden',
                  backgroundColor: '#111111',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  flexShrink: 0,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}
              >
                {selectedPlaylist.cover_uri ? (
                  <img
                    src={formatCoverUrl(selectedPlaylist.cover_uri, '200x200')}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Sparkles size={36} color="#a3021a" />
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#a3021a',
                    letterSpacing: '0.04em',
                  }}
                >
                  {selectedPlaylist.header || 'Персональный микс'}
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', marginTop: 4, letterSpacing: '-0.02em' }}>
                  {selectedPlaylist.title}
                </h1>
                <div
                  style={{
                    fontSize: 12,
                    color: '#888888',
                    marginTop: 6,
                    maxWidth: 600,
                  }}
                >
                  {selectedPlaylist.description || `${selectedPlaylist.track_count} треков, собранных алгоритмами`}
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
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.2)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Play size={15} fill="#000000" color="#000000" />
                <span>Слушать плейлист</span>
              </button>
            )}
          </div>
        </div>

        {/* Tracks List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px 12px 140px' : '16px 36px 80px' }}>
          {loadingTracks ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, gap: 12 }}>
              <Loader2 size={24} className="animate-spin" color="#ffffff" />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#888888' }}>
                ЗАГРУЗКА ТРЕКОВ...
              </span>
            </div>
          ) : playlistTracks.length === 0 ? (
            <div style={{ color: '#666666', textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-mono)' }}>
              В этом плейлисте пока нет треков.
            </div>
          ) : (
            playlistTracks.map((track, idx) => (
              <TrackItemRow
                key={`${track.id}-${idx}`}
                track={track}
                index={idx}
                tracks={playlistTracks}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading && !data) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Loader2 size={28} className="animate-spin" color="#ffffff" />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#888888', letterSpacing: '0.06em' }}>
          СИНХРОНИЗАЦИЯ РЕКОМЕНДАЦИЙ ЯНДЕКС МУЗЫКИ...
        </span>
      </div>
    );
  }

  const personalPlaylists = data?.personal_playlists || [];
  const chartTracks = data?.chart_tracks || [];
  const newReleases = data?.new_releases || [];

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#050505',
        padding: isMobile ? '16px 14px 140px' : '32px 40px 90px',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: 20,
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
            Главная
          </h1>
          <p style={{ fontSize: 13, color: '#888888', marginTop: 4, margin: '4px 0 0' }}>
            Рекомендации, Моя Волна и тренды
          </p>
        </div>

        {/* View Switcher: Главное / Чарт */}
        <div style={{ display: 'flex', gap: 3, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 3, borderRadius: 8 }}>
          <button
            onClick={() => setViewMode('overview')}
            style={{
              padding: '6px 16px',
              backgroundColor: viewMode === 'overview' ? '#ffffff' : 'transparent',
              color: viewMode === 'overview' ? '#000000' : '#888888',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: viewMode === 'overview' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            Главное
          </button>
          <button
            onClick={() => setViewMode('chart')}
            style={{
              padding: '6px 16px',
              backgroundColor: viewMode === 'chart' ? '#ffffff' : 'transparent',
              color: viewMode === 'chart' ? '#000000' : '#888888',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: viewMode === 'chart' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            Чарт Топ-100
          </button>
        </div>
      </div>

      {viewMode === 'overview' ? (
        <>
          {/* HERO: Моя Волна (1-Click Station) */}
          <section
            style={{
              marginBottom: isMobile ? 24 : 36,
              background: 'linear-gradient(135deg, rgba(163, 2, 26, 0.16) 0%, rgba(120, 1, 18, 0.08) 50%, rgba(18, 18, 18, 0.6) 100%)',
              border: '1px solid rgba(163, 2, 26, 0.3)',
              borderRadius: 16,
              padding: isMobile ? '16px' : '24px 28px',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              gap: isMobile ? 16 : 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#a3021a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(163, 2, 26, 0.45)',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
                onClick={() => startWave()}
                title="Включить Мою Волну"
              >
                <Radio size={28} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Моя Волна
                  </h2>
                  {waveMode && isPlaying && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', backgroundColor: '#a3021a', padding: '2px 8px', borderRadius: 10 }}>
                      Сейчас играет
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: '#aaaaaa', margin: '0 0 12px 0', maxWidth: 440 }}>
                  Бесконечный поток музыки, который подстраивается под ваши вкусы и настроение.
                </p>

                {/* Quick Mood & Activity Filter Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: 'Бодрое', opt: { mood: 'active' } },
                    { label: 'Спокойное', opt: { mood: 'calm' } },
                    { label: 'Любимое', opt: { character: 'favorite' } },
                    { label: 'Незнакомое', opt: { character: 'discover' } },
                    { label: 'Работа', opt: { activity: 'work-background' } },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => startCustomWave(chip.opt)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 14,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: '#dddddd',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.color = '#000000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.color = '#dddddd';
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Buttons: Play / Settings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setWaveSettingsOpen(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
              >
                <Sliders size={14} />
                <span>Настроить</span>
              </button>

              <button
                onClick={() => startWave()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  borderRadius: 10,
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.25)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Play size={16} fill="#000000" />
                <span>Слушать волну</span>
              </button>
            </div>
          </section>
          {/* SECTION 1: Персональные плейлисты Яндекса */}
          {personalPlaylists.length > 0 && (
            <section style={{ marginBottom: 44 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={16} color="#a3021a" />
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    Персональные подборки
                  </h2>
                </div>
                <span style={{ fontSize: 11, color: '#666666' }}>
                  Обновляются ежедневно
                </span>
              </div>

              {/* Grid of 4 Personal Mixes */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: isMobile ? 10 : 16,
                }}
              >
                {personalPlaylists.map((playlist) => (
                  <div
                    key={playlist.kind}
                    onClick={() => handleSelectPlaylist(playlist)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 12,
                      padding: 18,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: 190,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(163, 2, 26, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#a3021a',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {playlist.header || 'Персонально'}
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 6, lineHeight: 1.2 }}>
                        {playlist.title}
                      </h3>
                      <p
                        style={{
                          fontSize: 11,
                          color: '#777777',
                          marginTop: 6,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {playlist.description || 'Треки, подобранные на основе ваших предпочтений.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#555555' }}>
                        {playlist.track_count} ТРЕКОВ
                      </span>

                      <button
                        onClick={(e) => handleQuickPlayPlaylist(e, playlist)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(255,255,255,0.2)',
                          transition: 'transform 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        title="Воспроизвести прямо сейчас"
                      >
                        <Play size={14} fill="#000000" color="#000000" style={{ marginLeft: 2 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SECTION 2: Топ-5 из Чарта (Превью с кнопкой перехода в полный чарт) */}
          {chartTracks.length > 0 && (
            <section style={{ marginBottom: 44 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Flame size={16} color="#a3021a" />
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    Чарт Топ-10
                  </h2>
                </div>

                <button
                  onClick={() => setViewMode('chart')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888888',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
                >
                  Смотреть все 100 треков →
                </button>
              </div>

              {/* Top Chart Tracks List (first 10) */}
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 14, padding: '12px 16px' }}>
                {chartTracks.slice(0, 10).map((item, idx) => (
                  <ChartItemRow
                    key={`${item.track.id}-${idx}`}
                    chartItem={item}
                    index={idx}
                    allTracks={chartTracks.map((c) => c.track)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* SECTION 3: Свежие релизы (Новые альбомы) */}
          {newReleases.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <TrendingUp size={16} color="#a3021a" />
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  Новые релизы
                </h2>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: isMobile ? 10 : 16,
                }}
              >
                {newReleases.slice(0, 12).map((album) => (
                  <div
                    key={album.id}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(163, 2, 26, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1/1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#161616',
                      }}
                    >
                      {album.cover_uri ? (
                        <img
                          src={formatCoverUrl(album.cover_uri, '200x200')}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Disc size={32} color="#444444" />
                        </div>
                      )}
                    </div>

                    <div>
                      <h4
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {album.title}
                      </h4>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#777777',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: 2,
                        }}
                      >
                        {album.artist_name || 'Артист'}
                      </div>
                      {album.year && (
                        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#555555', marginTop: 4 }}>
                          {album.year}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* FULL 100 CHART VIEW */
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>
                Чарт Топ-100
              </h2>
              <span style={{ fontSize: 12, color: '#888888' }}>
                Самые популярные треки прямо сейчас
              </span>
            </div>

            {chartTracks.length > 0 && (
              <button
                onClick={() => setQueue(chartTracks.map((c) => c.track), 0)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.2)',
                }}
              >
                <Play size={14} fill="#000000" color="#000000" />
                <span>Слушать весь чарт</span>
              </button>
            )}
          </div>

          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 14, padding: '12px 16px' }}>
            {chartTracks.map((item, idx) => (
              <ChartItemRow
                key={`${item.track.id}-${idx}`}
                chartItem={item}
                index={idx}
                allTracks={chartTracks.map((c) => c.track)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Subcomponent: Row with Position badge (01, 02..), Shift indicator (▲, ▼, NEW), and Track controls
function ChartItemRow({
  chartItem,
  index,
  allTracks,
}: {
  chartItem: ChartTrack;
  index: number;
  allTracks: TrackItem[];
}) {
  const { track, position, progress, shift } = chartItem;
  const isTop3 = position <= 3;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '46px 1fr',
        alignItems: 'center',
        borderBottom: '1px solid #111111',
      }}
    >
      {/* Position Badge & Dynamics */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingRight: 6,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: isTop3 ? 15 : 12,
            fontWeight: 900,
            color: position === 1 ? '#ffffff' : position === 2 ? '#cccccc' : position === 3 ? '#999999' : '#555555',
          }}
        >
          {String(position).padStart(2, '0')}
        </span>

        {/* Progress Shift: up / down / new / same */}
        {progress === 'new' ? (
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#2bf0ff', fontWeight: 800 }}>
            NEW
          </span>
        ) : progress === 'up' ? (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#55ff55' }}>
            ▲{shift ? Math.abs(shift) : ''}
          </span>
        ) : progress === 'down' ? (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#ff4444' }}>
            ▼{shift ? Math.abs(shift) : ''}
          </span>
        ) : (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#444444' }}>
            —
          </span>
        )}
      </div>

      {/* TrackItemRow handles Artwork, Title, Wave by track, Like, Duration */}
      <TrackItemRow track={track} index={index} tracks={allTracks} />
    </div>
  );
}
