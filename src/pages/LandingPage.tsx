import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  ArrowLeft,
  Flame,
  Sparkles,
  Radio,
  SlidersHorizontal,
  Search,
  Loader2,
  Disc,
  Settings,
} from 'lucide-react';
import * as api from '../api';
import { usePlayerStore } from '../store/playerStore';
import { useWindowStore } from '../store/windowStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { TrackItemRow } from '../components/TrackItemRow';
import { WaveVisualizerOrb } from '../components/WaveVisualizerOrb';
import type { LandingData, PersonalPlaylist, TrackItem, ChartTrack } from '../types';
import { formatCoverUrl } from '../types';

interface LandingPageProps {
  onSelectTab?: (tab: 'landing' | 'collection' | 'search') => void;
}

const CHARACTER_CHIPS = [
  { id: 'favorite', label: 'Любимое', desc: 'Сфера' },
  { id: 'discover', label: 'Незнакомое', desc: 'Призма' },
  { id: 'popular', label: 'Популярное', desc: 'Корона' },
] as const;

const MOOD_CHIPS = [
  { id: 'active', label: 'Бодрое', type: 'mood' as const },
  { id: 'fun', label: 'Радостное', type: 'mood' as const },
  { id: 'calm', label: 'Спокойное', type: 'mood' as const },
  { id: 'sad', label: 'Грустное', type: 'mood' as const },
  { id: 'driving', label: 'Ночной драйв', type: 'activity' as const },
  { id: 'work-background', label: 'Фокус', type: 'activity' as const },
  { id: 'workout', label: 'Тренировка', type: 'activity' as const },
];

export function LandingPage({ onSelectTab }: LandingPageProps) {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PersonalPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<TrackItem[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'chart'>('overview');

  const {
    playTrack,
    setQueue,
    isPlaying,
    togglePlay,
    waveMode,
    waveSettings,
    startWave,
    startCustomWave,
  } = usePlayerStore();

  const { setWaveSettingsOpen, setSettingsOpen } = useWindowStore();
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

  const handleToggleCharacter = (charId: string) => {
    const current = waveSettings || {};
    const isSelected = waveMode && current.character === charId;

    const nextSettings: { activity?: string; mood?: string; character?: string; language?: string } = {
      mood: current.mood,
      activity: current.activity,
      language: current.language,
      character: isSelected ? undefined : charId,
    };

    if (!nextSettings.character && !nextSettings.mood && !nextSettings.activity && !nextSettings.language) {
      startWave();
    } else {
      startCustomWave(nextSettings);
    }
  };

  const handleToggleMood = (item: { id: string; type: 'mood' | 'activity' }) => {
    const current = waveSettings || {};
    const isSelected =
      waveMode &&
      ((item.type === 'mood' && current.mood === item.id) ||
       (item.type === 'activity' && current.activity === item.id));

    const nextSettings: { activity?: string; mood?: string; character?: string; language?: string } = {
      character: current.character,
      language: current.language,
      mood: item.type === 'mood' && !isSelected ? item.id : undefined,
      activity: item.type === 'activity' && !isSelected ? item.id : undefined,
    };

    if (!nextSettings.character && !nextSettings.mood && !nextSettings.activity && !nextSettings.language) {
      startWave();
    } else {
      startCustomWave(nextSettings);
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

  const handlePlayChartTrack = (track: TrackItem, index: number) => {
    const allChartTracks = (data?.chart_tracks || []).map((ct) => ct.track);
    playTrack(track, allChartTracks, index);
  };

  // 1. Detail View when a Personal Playlist is opened
  if (selectedPlaylist) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-dark-surface text-dark-on-surface">
        {/* Detail Header */}
        <div className="p-gutter-md border-b border-dark-outline-variant bg-dark-surface-container-low shrink-0">
          <button
            type="button"
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-gutter-xs text-muted hover:text-dark-on-surface text-body-sm mb-gutter-md transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Назад к рекомендациям</span>
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
                <div className="w-full h-full flex items-center justify-center text-accent">
                  <Sparkles size={36} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="font-label text-label-sm text-accent uppercase tracking-wider">
                {selectedPlaylist.header || 'Персональный микс'}
              </span>
              <h1 className="font-headline text-headline-md text-dark-on-surface truncate mt-0.5">
                {selectedPlaylist.title}
              </h1>
              <p className="font-body text-body-sm text-muted truncate mt-1">
                {selectedPlaylist.description || `${selectedPlaylist.track_count} треков`}
              </p>
            </div>

            {playlistTracks.length > 0 && !loadingTracks && (
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
          {loadingTracks ? (
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

  // 2. Loading State
  if (loading && !data) {
    return (
      <div className="h-full flex items-center justify-center gap-gutter-md text-muted font-mono text-label-md bg-dark-surface">
        <Loader2 size={28} className="animate-spin text-accent" />
        <span className="tracking-wider">СИНХРОНИЗАЦИЯ РЕКОМЕНДАЦИЙ...</span>
      </div>
    );
  }

  const personalPlaylists = data?.personal_playlists || [];
  const chartTracks = data?.chart_tracks || [];

  // Find specific playlists for the Bento grid
  const premierePlaylist =
    personalPlaylists.find(
      (p) =>
        p.title.toLowerCase().includes('премьера') ||
        p.header?.toLowerCase().includes('премьера')
    ) || personalPlaylists[0];

  const dejavuPlaylist =
    personalPlaylists.find(
      (p) =>
        p.title.toLowerCase().includes('дежавю') ||
        p.header?.toLowerCase().includes('дежавю')
    ) || personalPlaylists[1];

  const dailyMixPlaylist =
    personalPlaylists.find(
      (p) =>
        p.title.toLowerCase().includes('дня') ||
        p.title.toLowerCase().includes('микс') ||
        p.header?.toLowerCase().includes('дня')
    ) || personalPlaylists[2];

  // ==========================================
  // MOBILE VIEW: 01-home-flow.html
  // ==========================================
  if (isMobile) {
    return (
      <div className="h-full w-full flex flex-col relative pb-44 bg-dark-surface text-dark-on-surface antialiased select-none overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* Minimal Airy Top Bar: Quick Search + Wave Settings + App Settings */}
        <header className="sticky top-0 z-20 bg-dark-surface/95 backdrop-blur-md px-page-margin pt-[calc(10px+var(--sat,0px))] pb-gutter-md flex items-center justify-between gap-gutter-sm border-b border-dark-outline-variant/30 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab?.('search')}
            aria-label="Быстрый поиск музыки"
            className="flex-1 flex items-center gap-gutter-sm px-gutter-lg py-2 rounded-full bg-dark-surface-container-low border border-dark-outline-variant text-muted hover:text-dark-on-surface transition-colors duration-state-change active:scale-[0.99]"
          >
            <Search size={16} />
            <span className="font-body text-body-sm truncate">Треки, артисты, плейлисты</span>
          </button>

          <div className="flex items-center gap-gutter-xs shrink-0">
            <button
              type="button"
              onClick={() => setWaveSettingsOpen(true)}
              aria-label="Настройки Волны"
              title="Настройки Волны"
              className="w-9 h-9 rounded-full bg-dark-surface-container-high border border-dark-outline-variant flex items-center justify-center text-dark-on-surface active:scale-95 transition-transform duration-state-change"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Настройки приложения"
              title="Настройки"
              className="w-9 h-9 rounded-full bg-dark-surface-container-high border border-dark-outline-variant flex items-center justify-center text-dark-on-surface active:scale-95 transition-transform duration-state-change"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {/* Main Flow Content */}
        <main className="flex-1 flex flex-col gap-section px-page-margin pt-gutter-xs">
          {/* 1. Open Dynamic Wave Stage (Acoustic Orb) */}
          <section aria-label="Живая Волна" className="relative flex flex-col items-center text-center gap-gutter-sm pt-gutter-xs">
            {/* Ambient Glow */}
            <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-accent opacity-15 blur-3xl" />

            {/* Visual Acoustic Orb (Clean, full-width, unclipped, responds to any audio) */}
            <WaveVisualizerOrb
              onTogglePlay={() => {
                if (isPlaying) {
                  togglePlay();
                } else if (waveMode) {
                  togglePlay();
                } else {
                  startWave();
                }
              }}
              isPlaying={isPlaying}
              hideCenterButton={true}
            />

            {/* Title & Primary Control Bar (Moved below orb for clean core view) */}
            <div className="flex items-center justify-center gap-3.5 -mt-2 mb-1">
              <button
                type="button"
                onClick={() => {
                  if (isPlaying) {
                    togglePlay();
                  } else if (waveMode) {
                    togglePlay();
                  } else {
                    startWave();
                  }
                }}
                aria-label={isPlaying ? 'Пауза' : 'Включить Мою Волну'}
                className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-[0_4px_22px_rgba(255,59,92,0.45)] hover:scale-105 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer"
              >
                {isPlaying ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} className="ml-0.5" fill="currentColor" />
                )}
              </button>

              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-display-lg-mobile text-dark-on-surface">
                    Моя Волна
                  </h1>
                  {isPlaying && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                  )}
                </div>
                <p className="font-body text-body-xs text-muted truncate max-w-[220px]">
                  {waveMode && waveSettings?.character
                    ? `${waveSettings.character === 'discover' ? 'Незнакомое' : waveSettings.character === 'popular' ? 'Популярное' : 'Любимое'} · `
                    : ''}
                  {isPlaying ? 'Играет персональный поток' : 'Живой поток под ваш ритм'}
                </p>
              </div>
            </div>

            {/* Character & Mood Filter Rows */}
            <div className="w-full flex flex-col gap-2 pt-1">
              {/* Row 1: Character (Форма ядра) */}
              <div className="w-full overflow-x-auto no-scrollbar py-0.5">
                <div className="inline-flex items-center gap-1.5 px-1" role="group" aria-label="Характер Волны (Форма)">
                  <span className="text-[11px] font-mono text-muted/70 uppercase tracking-wider pl-1 pr-1 shrink-0">Форма:</span>
                  {CHARACTER_CHIPS.map((chip) => {
                    const isPressed = Boolean(waveMode && waveSettings?.character === chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        aria-pressed={isPressed}
                        onClick={() => handleToggleCharacter(chip.id)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border shrink-0 transition-all duration-state-change active:scale-95 ${
                          isPressed
                            ? 'bg-accent/20 text-accent border-accent font-semibold shadow-sm'
                            : 'bg-dark-surface-container-low text-dark-on-surface border-dark-outline-variant hover:border-dark-on-surface/40'
                        }`}
                      >
                        <span className="font-label text-label-sm">{chip.label}</span>
                        <span className="text-[10px] opacity-60">({chip.desc})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Mood & Activity (Цвет ауры) */}
              <div className="w-full overflow-x-auto no-scrollbar py-0.5">
                <div className="inline-flex items-center gap-1.5 px-1" role="group" aria-label="Настроение потока (Цвет)">
                  <span className="text-[11px] font-mono text-muted/70 uppercase tracking-wider pl-1 pr-1 shrink-0">Цвет:</span>
                  {MOOD_CHIPS.map((chip) => {
                    const isPressed = Boolean(
                      waveMode &&
                        ((chip.type === 'mood' && waveSettings?.mood === chip.id) ||
                         (chip.type === 'activity' && waveSettings?.activity === chip.id))
                    );

                    return (
                      <button
                        key={chip.id}
                        type="button"
                        aria-pressed={isPressed}
                        onClick={() => handleToggleMood(chip)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full border shrink-0 transition-all duration-state-change active:scale-95 ${
                          isPressed
                            ? 'bg-accent/20 text-accent border-accent font-semibold shadow-sm'
                            : 'bg-dark-surface-container-low text-muted hover:text-dark-on-surface border-dark-outline-variant'
                        }`}
                      >
                        <span className="font-label text-label-sm">{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Asymmetric Bento Mixes ("Собрано для вас") */}
          <section className="flex flex-col gap-gutter-md" aria-labelledby="bento-mixes-title">
            <div className="flex items-baseline justify-between">
              <h2 id="bento-mixes-title" className="font-headline text-headline-md text-dark-on-surface">
                Собрано для вас
              </h2>
              <span className="font-label text-label-sm text-muted">Сегодня</span>
            </div>

            <div className="grid grid-cols-2 gap-gutter-md items-stretch">
              {/* Tall Feature Card: Плейлист дня / Микс дня (Prominent Big Card) */}
              {dailyMixPlaylist ? (
                <article
                  onClick={() => handleSelectPlaylist(dailyMixPlaylist)}
                  className="rounded-xl bg-dark-surface-container-low p-gutter-md flex flex-col justify-between gap-gutter-md border border-dark-outline-variant cursor-pointer active:scale-[0.98] transition-transform duration-state-change"
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-dark-surface-container shadow-sm">
                    {dailyMixPlaylist.cover_uri ? (
                      <img
                        src={formatCoverUrl(dailyMixPlaylist.cover_uri, '400x400')}
                        alt={dailyMixPlaylist.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-accent">
                        <Sparkles size={36} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-gutter-sm">
                    <div className="flex flex-col gap-gutter-xs min-w-0">
                      <span className="font-label text-label-sm text-accent">Плейлист дня</span>
                      <h3 className="font-headline text-title-lg text-dark-on-surface truncate">
                        {dailyMixPlaylist.title}
                      </h3>
                      <span className="font-mono text-mono-sm text-muted tabular-nums">
                        {dailyMixPlaylist.track_count || 30} треков
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleQuickPlayPlaylist(e, dailyMixPlaylist)}
                      aria-label="Слушать Плейлист дня"
                      className="shrink-0 w-9 h-9 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center active:scale-95 transition-transform duration-state-change shadow-md"
                    >
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                </article>
              ) : null}

              {/* Stacked Right Column: Премьера + Дежавю */}
              <div className="flex flex-col gap-gutter-md">
                {premierePlaylist && (
                  <article
                    onClick={() => handleSelectPlaylist(premierePlaylist)}
                    className="flex-1 rounded-xl bg-dark-surface-container-low p-gutter-md flex items-center gap-gutter-md border border-dark-outline-variant cursor-pointer active:scale-[0.98] transition-transform duration-state-change"
                  >
                    {premierePlaylist.cover_uri ? (
                      <img
                        src={formatCoverUrl(premierePlaylist.cover_uri, '200x200')}
                        alt={premierePlaylist.title}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-dark-surface-container shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-dark-surface-container flex items-center justify-center shrink-0 text-accent">
                        <Sparkles size={24} />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-label text-label-xs text-accent">Новинки</span>
                      <h3 className="font-headline text-title-md text-dark-on-surface truncate">
                        {premierePlaylist.title}
                      </h3>
                      <span className="font-mono text-label-sm text-muted tabular-nums">
                        {premierePlaylist.track_count || 20} треков
                      </span>
                    </div>
                  </article>
                )}

                {dejavuPlaylist && (
                  <article
                    onClick={() => handleSelectPlaylist(dejavuPlaylist)}
                    className="flex-1 rounded-xl bg-dark-surface-container-low p-gutter-md flex items-center gap-gutter-md border border-dark-outline-variant cursor-pointer active:scale-[0.98] transition-transform duration-state-change"
                  >
                    {dejavuPlaylist.cover_uri ? (
                      <img
                        src={formatCoverUrl(dejavuPlaylist.cover_uri, '200x200')}
                        alt={dejavuPlaylist.title}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-dark-surface-container shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-dark-surface-container flex items-center justify-center shrink-0 text-accent">
                        <Sparkles size={24} />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-label text-label-xs text-muted">Вспомнить</span>
                      <h3 className="font-headline text-title-md text-dark-on-surface truncate">
                        {dejavuPlaylist.title}
                      </h3>
                      <span className="font-mono text-label-sm text-muted tabular-nums">
                        {dejavuPlaylist.track_count || 30} треков
                      </span>
                    </div>
                  </article>
                )}
              </div>
            </div>
          </section>

          {/* 3. Live Chart Strip (Топ-100) */}
          <section className="flex flex-col gap-gutter-md" aria-labelledby="chart-strip-title">
            <div className="flex items-baseline justify-between">
              <h2 id="chart-strip-title" className="font-headline text-headline-md text-dark-on-surface">
                Чарт Топ-100
              </h2>
              <span className="font-label text-label-md text-accent">Топ треки</span>
            </div>

            <div className="flex flex-col gap-gutter-xs">
              {chartTracks.slice(0, 10).map((item, index) => {
                const track = item.track;
                const position = item.position || index + 1;
                const shift = item.shift ?? 0;
                const cover = track.cover_uri
                  ? formatCoverUrl(track.cover_uri, '100x100')
                  : null;

                return (
                  <div
                    key={`${track.id}-${index}`}
                    onClick={() => handlePlayChartTrack(track, index)}
                    className="flex items-center justify-between gap-gutter-md p-gutter-sm rounded-lg bg-dark-surface-container-low hover:bg-dark-surface-container cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-gutter-md min-w-0">
                      <span
                        className={`font-mono text-title-md w-5 text-center tabular-nums shrink-0 ${
                          position === 1 ? 'text-accent font-bold' : 'text-muted'
                        }`}
                      >
                        {position}
                      </span>

                      {cover ? (
                        <img
                          src={cover}
                          alt={track.title}
                          className="w-11 h-11 rounded-md object-cover shrink-0 bg-dark-surface-container"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-md bg-dark-surface-container flex items-center justify-center shrink-0 text-muted">
                          <Disc size={18} />
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

                    <span
                      className={`font-mono text-label-sm tabular-nums shrink-0 ${
                        shift > 0
                          ? 'text-dark-tertiary'
                          : shift < 0
                          ? 'text-dark-error'
                          : 'text-muted'
                      }`}
                    >
                      {shift > 0 ? `↑ +${shift}` : shift < 0 ? `↓ ${shift}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW
  // ==========================================
  return (
    <div className="h-full overflow-y-auto bg-dark-surface text-dark-on-surface p-8 pb-28 no-scrollbar">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-dark-outline-variant pb-5 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-dark-on-surface">
            Главная
          </h1>
          <p className="text-body-sm text-muted mt-1">Рекомендации, Моя Волна и тренды</p>
        </div>

        {/* View Switcher: Главное / Чарт */}
        <div className="flex gap-1 bg-dark-surface-container-low p-1 rounded-lg border border-dark-outline-variant">
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className={`px-4 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${
              viewMode === 'overview'
                ? 'bg-dark-on-surface text-dark-surface'
                : 'text-muted hover:text-dark-on-surface'
            }`}
          >
            Главное
          </button>
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={`px-4 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${
              viewMode === 'chart'
                ? 'bg-dark-on-surface text-dark-surface'
                : 'text-muted hover:text-dark-on-surface'
            }`}
          >
            Чарт Топ-100
          </button>
        </div>
      </div>

      {viewMode === 'overview' ? (
        <>
          {/* HERO: Моя Волна (Acoustic Fluid Orb Stage) */}
          <section className="mb-9 p-8 rounded-3xl bg-gradient-to-r from-dark-surface-container via-dark-surface-container-low to-dark-surface border border-dark-outline-variant flex items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
            {/* Ambient Glow */}
            <div className="pointer-events-none absolute -top-10 -left-10 w-96 h-96 rounded-full bg-accent opacity-10 blur-3xl" />

            <div className="flex-1 z-10 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) {
                      togglePlay();
                    } else if (waveMode) {
                      togglePlay();
                    } else {
                      startWave();
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                  aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                >
                  {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} className="ml-0.5" fill="currentColor" />}
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl font-bold text-dark-on-surface">Моя Волна</h2>
                  {waveMode && isPlaying && (
                    <span className="text-label-xs font-bold bg-accent text-dark-surface px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                      Сейчас играет
                    </span>
                  )}
                </div>
              </div>
              <p className="text-body-sm text-muted max-w-lg">
                Бесконечный живой поток музыки, который подстраивается под ваши вкусы и текущий ритм.
              </p>

              {/* Desktop Filter Chips */}
              <div className="flex flex-col gap-2.5 pt-1">
                {/* Character row */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted/70 uppercase tracking-wider shrink-0 w-14">Форма:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CHARACTER_CHIPS.map((chip) => {
                      const isActive = Boolean(waveMode && waveSettings?.character === chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handleToggleCharacter(chip.id)}
                          className={`px-3 py-1 rounded-full text-label-sm transition-all border active:scale-95 cursor-pointer ${
                            isActive
                              ? 'bg-accent/20 text-accent border-accent font-semibold shadow-sm'
                              : 'bg-dark-surface-container-high border-dark-outline-variant text-muted hover:text-dark-on-surface'
                          }`}
                        >
                          {chip.label} <span className="text-[10px] opacity-60">({chip.desc})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mood row */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted/70 uppercase tracking-wider shrink-0 w-14">Цвет:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MOOD_CHIPS.map((chip) => {
                      const isActive = Boolean(
                        waveMode &&
                          ((chip.type === 'mood' && waveSettings?.mood === chip.id) ||
                           (chip.type === 'activity' && waveSettings?.activity === chip.id))
                      );
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handleToggleMood(chip)}
                          className={`px-3 py-1 rounded-full text-label-sm transition-all border active:scale-95 cursor-pointer ${
                            isActive
                              ? 'bg-accent/20 text-accent border-accent font-semibold shadow-sm'
                              : 'bg-dark-surface-container-high border-dark-outline-variant text-muted hover:text-dark-on-surface'
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Acoustic Fluid Orb */}
            <div className="w-72 h-72 lg:w-84 lg:h-84 shrink-0 relative flex items-center justify-center z-10 overflow-visible">
              <WaveVisualizerOrb
                onTogglePlay={() => {
                  if (isPlaying) {
                    togglePlay();
                  } else if (waveMode) {
                    togglePlay();
                  } else {
                    startWave();
                  }
                }}
                isPlaying={isPlaying}
              />
            </div>
          </section>

          {/* Personal Playlists Grid */}
          <section className="mb-10">
            <h2 className="font-headline text-headline-md text-dark-on-surface mb-4">
              Собрано для вас
            </h2>
            <div className="grid grid-cols-4 gap-4">
              {personalPlaylists.map((pl) => (
                <div
                  key={pl.kind}
                  onClick={() => handleSelectPlaylist(pl)}
                  className="p-3.5 rounded-xl bg-dark-surface-container-low border border-dark-outline-variant hover:bg-dark-surface-container cursor-pointer transition-all group"
                >
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-dark-surface-container mb-3 relative">
                    {pl.cover_uri ? (
                      <img
                        src={formatCoverUrl(pl.cover_uri, '400x400')}
                        alt={pl.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-accent">
                        <Sparkles size={32} />
                      </div>
                    )}
                  </div>
                  <h3 className="font-headline text-title-md text-dark-on-surface truncate">
                    {pl.title}
                  </h3>
                  <p className="font-mono text-label-sm text-muted mt-1">
                    {pl.track_count} треков
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Full Chart View */
        <section className="flex flex-col gap-2">
          {chartTracks.map((item, idx) => (
            <div
              key={`${item.track.id}-${idx}`}
              onClick={() => handlePlayChartTrack(item.track, idx)}
              className="flex items-center justify-between p-2.5 rounded-lg bg-dark-surface-container-low hover:bg-dark-surface-container cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-mono text-title-md w-6 text-center tabular-nums text-muted">
                  {idx + 1}
                </span>
                <img
                  src={formatCoverUrl(item.track.cover_uri, '100x100')}
                  alt={item.track.title}
                  className="w-11 h-11 rounded-md object-cover"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-title text-title-md text-dark-on-surface truncate">
                    {item.track.title}
                  </span>
                  <span className="font-body text-body-sm text-muted truncate">
                    {item.track.artists.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
export default LandingPage;
