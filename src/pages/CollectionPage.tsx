import React, { useEffect, useState } from 'react';
import {
  Play,
  Heart,
  Loader2,
  Shuffle,
  ArrowLeft,
  Disc,
  Search,
  CheckCircle,
  Radio,
  X,
  Settings,
} from 'lucide-react';
import * as api from '../api';
import { usePlayerStore } from '../store/playerStore';
import { useWindowStore } from '../store/windowStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { TrackItemRow } from '../components/TrackItemRow';
import type { Playlist, TrackItem } from '../types';
import { formatCoverUrl, formatDuration } from '../types';

interface CollectionPageProps {
  onSelectTab?: (tab: 'landing' | 'collection' | 'search') => void;
}

export function CollectionPage({ onSelectTab }: CollectionPageProps) {
  const isMobile = useIsMobile();
  const { setSettingsOpen } = useWindowStore();
  const [subTab, setSubTab] = useState<'liked' | 'playlists'>('liked');

  // Search filter inside collection
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Liked tracks state
  const [likedTracks, setLikedTracks] = useState<TrackItem[]>([]);
  const [loadingLiked, setLoadingLiked] = useState(true);

  // Playlists state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>([]);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);

  const {
    setQueue,
    playTrack,
    setLikedIds,
    likedIds,
    toggleLike,
    isLiked,
    startEntityWave,
  } = usePlayerStore();

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

  const visibleLiked = likedTracks
    .filter((t) => likedIds.size === 0 || likedIds.has(t.id))
    .filter((t) => {
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.artists.some((a) => a.toLowerCase().includes(q))
      );
    });

  const visiblePlaylists = playlists.filter((p) => {
    if (!filterQuery.trim()) return true;
    return p.title.toLowerCase().includes(filterQuery.toLowerCase());
  });

  const handleShuffleLiked = () => {
    if (visibleLiked.length === 0) return;
    const shuffled = [...visibleLiked].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
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

  // 1. Detail View when a Playlist is opened
  if (selectedPlaylist) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-dark-surface text-dark-on-surface select-none">
        {/* Header */}
        <div className="p-gutter-md border-b border-dark-outline-variant bg-dark-surface-container-low shrink-0">
          <button
            type="button"
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-gutter-xs text-muted hover:text-dark-on-surface text-body-sm mb-gutter-md transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Назад к коллекции</span>
          </button>

          <div className="flex items-center gap-gutter-lg">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-dark-surface-container border border-dark-outline-variant shrink-0 shadow-lg">
              {selectedPlaylist.cover_uri ? (
                <img
                  src={formatCoverUrl(selectedPlaylist.cover_uri, '200x200')}
                  alt={selectedPlaylist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  <Disc size={36} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="font-label text-label-sm text-accent uppercase tracking-wider">
                Плейлист
              </span>
              <h1 className="font-headline text-headline-md text-dark-on-surface truncate mt-0.5">
                {selectedPlaylist.title}
              </h1>
              <p className="font-mono text-label-sm text-muted mt-1">
                {selectedPlaylist.track_count || playlistTracks.length} треков
              </p>
            </div>

            {playlistTracks.length > 0 && !loadingPlaylistTracks && (
              <button
                type="button"
                onClick={() => setQueue(playlistTracks, 0)}
                className="shrink-0 w-11 h-11 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                title="Слушать плейлист"
              >
                <Play size={20} fill="currentColor" className="ml-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-gutter-md pb-44">
          {loadingPlaylistTracks ? (
            <div className="flex items-center justify-center h-48 gap-gutter-sm text-muted font-mono text-label-md">
              <Loader2 size={24} className="animate-spin text-accent" />
              <span>ЗАГРУЗКА ТРЕКОВ...</span>
            </div>
          ) : playlistTracks.length === 0 ? (
            <div className="text-center text-muted py-16 font-mono text-body-sm">
              В этом плейлисте пока нет треков.
            </div>
          ) : (
            <div className="flex flex-col gap-gutter-xs">
              {playlistTracks.map((track, idx) => (
                <TrackItemRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  tracks={playlistTracks}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // MOBILE VIEW: 04-collection-media.html
  // ==========================================
  if (isMobile) {
    return (
      <div className="min-h-full w-full max-w-md mx-auto flex flex-col relative pb-44 bg-dark-surface text-dark-on-surface antialiased select-none overflow-y-auto no-scrollbar">
        {/* Clean Top Bar */}
        <header className="sticky top-0 z-20 bg-dark-surface/95 backdrop-blur-md px-page-margin pt-[calc(10px+var(--sat,0px))] pb-gutter-md flex items-center justify-between gap-gutter-md border-b border-dark-outline-variant/30 shrink-0">
          <h1 className="font-display text-headline-lg text-dark-on-surface">Коллекция</h1>

          <div className="flex items-center gap-gutter-sm">
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Поиск по коллекции"
              className={`w-9 h-9 rounded-full border border-dark-outline-variant flex items-center justify-center transition-colors ${
                searchOpen
                  ? 'bg-accent/15 text-accent border-accent'
                  : 'bg-dark-surface-container-low text-dark-on-surface'
              }`}
            >
              <Search size={16} />
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Настройки приложения"
              title="Настройки"
              className="w-9 h-9 rounded-full bg-dark-surface-container-low border border-dark-outline-variant flex items-center justify-center text-dark-on-surface hover:text-accent active:scale-95 transition-transform"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {/* Live Filter Bar (if toggled open) */}
        {searchOpen && (
          <div className="px-page-margin py-gutter-sm bg-dark-surface-container-low border-b border-dark-outline-variant flex items-center gap-gutter-sm">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              autoFocus
              placeholder="Поиск по любимым и плейлистам..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-transparent border-none text-body-sm text-dark-on-surface placeholder:text-muted focus:outline-none flex-1"
            />
            {filterQuery && (
              <button type="button" onClick={() => setFilterQuery('')} className="text-muted hover:text-dark-on-surface">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Main Library Content */}
        <main className="flex-1 flex flex-col gap-gutter-xl px-page-margin pt-gutter-md">
          {/* 1. Visual Playlist Shelf (No hidden tabs!) */}
          <section className="flex flex-col gap-gutter-md" aria-labelledby="playlists-shelf-title">
            <div className="flex items-baseline justify-between">
              <h2 id="playlists-shelf-title" className="font-headline text-title-lg text-dark-on-surface">
                Плейлисты
              </h2>
              <span className="font-mono text-label-md text-muted tabular-nums">
                {visiblePlaylists.length}
              </span>
            </div>

            {loadingPlaylists ? (
              <div className="flex items-center gap-gutter-sm text-muted font-mono text-label-sm py-4">
                <Loader2 size={16} className="animate-spin text-accent" />
                <span>Загрузка плейлистов...</span>
              </div>
            ) : visiblePlaylists.length === 0 ? (
              <div className="text-muted text-body-sm py-3">Плейлистов не найдено</div>
            ) : (
              <div className="overflow-x-auto no-scrollbar -mx-page-margin px-page-margin">
                <div className="inline-flex items-stretch gap-gutter-md">
                  {visiblePlaylists.map((pl) => (
                    <article
                      key={pl.kind}
                      onClick={() => handleSelectPlaylist(pl)}
                      className="w-32 shrink-0 rounded-xl bg-dark-surface-container-low p-gutter-sm flex flex-col gap-gutter-sm border border-dark-outline-variant cursor-pointer active:scale-95 transition-transform"
                    >
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-dark-surface-container shadow-sm">
                        {pl.cover_uri ? (
                          <img
                            src={formatCoverUrl(pl.cover_uri, '200x200')}
                            alt={pl.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">
                            <Disc size={28} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-title text-label-lg text-dark-on-surface truncate">
                          {pl.title}
                        </span>
                        <span className="font-mono text-label-sm text-muted tabular-nums">
                          {pl.track_count || 0} треков
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 2. Liked Tracks + Instant Shuffle */}
          <section className="flex flex-col gap-gutter-md" aria-labelledby="liked-tracks-title">
            <div className="flex items-center justify-between gap-gutter-md">
              <div className="flex items-baseline gap-gutter-sm">
                <h2 id="liked-tracks-title" className="font-headline text-title-lg text-dark-on-surface">
                  Любимые
                </h2>
                <span className="font-mono text-label-md text-muted tabular-nums">
                  {visibleLiked.length}
                </span>
              </div>

              <button
                type="button"
                onClick={handleShuffleLiked}
                className="inline-flex items-center gap-gutter-xs px-gutter-lg py-gutter-sm rounded-full bg-dark-on-surface text-dark-surface active:scale-95 transition-transform duration-state-change shadow-sm"
              >
                <Shuffle size={16} />
                <span className="font-label text-label-md">Перемешать</span>
              </button>
            </div>

            {loadingLiked ? (
              <div className="flex items-center gap-gutter-sm text-muted font-mono text-label-sm py-8 justify-center">
                <Loader2 size={18} className="animate-spin text-accent" />
                <span>Загрузка любимых треков...</span>
              </div>
            ) : visibleLiked.length === 0 ? (
              <div className="text-center text-muted py-12 text-body-sm font-mono">
                {filterQuery ? 'Ничего не найдено по запросу' : 'У вас пока нет любимых треков'}
              </div>
            ) : (
              <ul className="flex flex-col gap-gutter-xs">
                {visibleLiked.map((track, idx) => {
                  const trackLiked = isLiked(track.id);
                  const cover = track.cover_uri
                    ? formatCoverUrl(track.cover_uri, '100x100')
                    : null;

                  return (
                    <li
                      key={`${track.id}-${idx}`}
                      onClick={() => playTrack(track, visibleLiked, idx)}
                      className="flex items-center justify-between gap-gutter-md p-gutter-sm rounded-xl hover:bg-dark-surface-container-low transition-colors duration-state-change cursor-pointer group"
                    >
                      <div className="flex items-center gap-gutter-md min-w-0 flex-1">
                        {cover ? (
                          <img
                            src={cover}
                            alt={track.title}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 bg-dark-surface-container shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-dark-surface-container flex items-center justify-center shrink-0 text-muted">
                            <Disc size={20} />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-title text-title-md text-dark-on-surface truncate">
                            {track.title}
                          </span>
                          <span className="font-body text-body-sm text-muted truncate">
                            {track.artists.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-gutter-sm shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-label-sm text-muted tabular-nums">
                          {formatDuration(track.duration_ms)}
                        </span>

                        <button
                          type="button"
                          onClick={() => startEntityWave('track', track.id)}
                          aria-label="Волна по треку"
                          title="Волна по треку"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-accent transition-colors active:scale-95"
                        >
                          <Radio size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleLike(track)}
                          aria-label={trackLiked ? 'Убрать из любимых' : 'Добавить в любимые'}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-accent transition-transform active:scale-95"
                        >
                          <Heart size={16} fill={trackLiked ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW
  // ==========================================
  return (
    <div className="h-full flex flex-col overflow-hidden bg-dark-surface text-dark-on-surface">
      {/* Top Header / Switcher */}
      <div className="p-6 border-b border-dark-outline-variant flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-dark-on-surface">
            Моя коллекция
          </h1>

          <div className="flex items-center bg-dark-surface-container-low border border-dark-outline-variant rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setSubTab('liked');
                setSelectedPlaylist(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${
                subTab === 'liked'
                  ? 'bg-dark-on-surface text-dark-surface'
                  : 'text-muted hover:text-dark-on-surface'
              }`}
            >
              <Heart size={14} fill={subTab === 'liked' ? 'currentColor' : 'none'} />
              <span>Любимые треки</span>
              <span className="opacity-70 font-mono">({visibleLiked.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('playlists');
                setSelectedPlaylist(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${
                subTab === 'playlists'
                  ? 'bg-dark-on-surface text-dark-surface'
                  : 'text-muted hover:text-dark-on-surface'
              }`}
            >
              <span>Плейлисты</span>
              <span className="opacity-70 font-mono">({playlists.length})</span>
            </button>
          </div>
        </div>

        {subTab === 'liked' && visibleLiked.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleShuffleLiked}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface-container-low border border-dark-outline-variant text-label-sm font-semibold text-dark-on-surface hover:bg-dark-surface-container transition-colors"
            >
              <Shuffle size={15} />
              <span>Перемешать</span>
            </button>

            <button
              type="button"
              onClick={() => setQueue(visibleLiked, 0)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-light-on-primary text-label-sm font-semibold shadow-md active:scale-95 transition-transform"
            >
              <Play size={15} fill="currentColor" />
              <span>Слушать всё</span>
            </button>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-28">
        {subTab === 'liked' ? (
          loadingLiked ? (
            <div className="flex items-center justify-center h-48 gap-3 text-muted font-mono text-label-md">
              <Loader2 size={24} className="animate-spin text-accent" />
              <span>ЗАГРУЗКА ЛЮБИМЫХ ТРЕКОВ...</span>
            </div>
          ) : visibleLiked.length === 0 ? (
            <div className="text-center text-muted py-20 font-mono text-body-sm">
              У вас пока нет любимых треков.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {visibleLiked.map((track, idx) => (
                <TrackItemRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  tracks={visibleLiked}
                />
              ))}
            </div>
          )
        ) : loadingPlaylists ? (
          <div className="flex items-center justify-center h-48 gap-3 text-muted font-mono text-label-md">
            <Loader2 size={24} className="animate-spin text-accent" />
            <span>ЗАГРУЗКА ПЛЕЙЛИСТОВ...</span>
          </div>
        ) : playlists.length === 0 ? (
          <div className="text-center text-muted py-20 font-mono text-body-sm">
            Плейлистов пока нет.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.kind}
                onClick={() => handleSelectPlaylist(pl)}
                className="p-3.5 rounded-xl bg-dark-surface-container-low border border-dark-outline-variant hover:bg-dark-surface-container cursor-pointer transition-all group"
              >
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-dark-surface-container mb-3 relative shadow-md">
                  {pl.cover_uri ? (
                    <img
                      src={formatCoverUrl(pl.cover_uri, '400x400')}
                      alt={pl.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <Disc size={36} />
                    </div>
                  )}
                </div>
                <h3 className="font-headline text-title-md text-dark-on-surface truncate">
                  {pl.title}
                </h3>
                <p className="font-mono text-label-sm text-muted mt-1">
                  {pl.track_count || 0} треков
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default CollectionPage;
