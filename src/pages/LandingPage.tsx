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
import type { LandingData, PersonalPlaylist, TrackItem, ChartTrack } from '../types';
import { formatCoverUrl } from '../types';

interface LandingPageProps {
  onSelectTab?: (tab: 'landing' | 'collection' | 'search') => void;
}

const MOOD_CHIPS = [
  { label: 'Бодрое', opt: { mood: 'active' } },
  { label: 'Ночной драйв', opt: { activity: 'driving' } },
  { label: 'Фокус', opt: { activity: 'work-background' } },
  { label: 'Незнакомое', opt: { character: 'discover' } },
  { label: 'Любимое', opt: { character: 'favorite' } },
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
      <div className="min-h-full w-full max-w-md mx-auto flex flex-col relative pb-44 bg-dark-surface text-dark-on-surface antialiased select-none overflow-y-auto no-scrollbar">
        {/* Minimal Airy Top Bar: Brand + Quick Search + Settings */}
        <header className="sticky top-0 z-20 bg-dark-surface/95 backdrop-blur-md px-page-margin pt-[calc(10px+var(--sat,0px))] pb-gutter-md flex items-center justify-between gap-gutter-md border-b border-dark-outline-variant/30 shrink-0">
          <div className="flex items-center gap-gutter-sm shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(255,59,92,0.8)]" />
            <span className="font-display text-title-lg text-dark-on-surface tracking-tight">YM</span>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab?.('search')}
            aria-label="Быстрый поиск музыки"
            className="flex-1 flex items-center gap-gutter-sm px-gutter-lg py-gutter-sm rounded-full bg-dark-surface-container-low border border-dark-outline-variant text-muted hover:text-dark-on-surface transition-colors duration-state-change"
          >
            <Search size={16} />
            <span className="font-body text-body-sm truncate">Треки, артисты, настроение</span>
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
          <section aria-label="Живая Волна" className="relative flex flex-col items-center text-center gap-gutter-lg pt-gutter-sm">
            {/* Ambient Glow */}
            <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-accent opacity-15 blur-3xl" />

            {/* Visual Acoustic Orb */}
            <div className="relative w-44 h-44 rounded-full overflow-hidden border border-dark-outline-variant shadow-2xl bg-gradient-to-tr from-dark-surface-container-lowest via-accent/30 to-dark-surface-container-high group">
              {/* Radial Animated Waves Background */}
              <div
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  waveMode && isPlaying ? 'scale-110 animate-spin [animation-duration:12s]' : ''
                }`}
                style={{
                  background:
                    'radial-gradient(circle at 35% 35%, #ff3b5c 0%, #BA0035 35%, #181B24 75%, #0B0E17 100%)',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-dark-surface/30 backdrop-blur-[2px]">
                <button
                  type="button"
                  onClick={() => {
                    if (waveMode && isPlaying) {
                      togglePlay();
                    } else if (waveMode) {
                      togglePlay();
                    } else {
                      startWave();
                    }
                  }}
                  aria-label="Запустить Мою Волну"
                  className="w-16 h-16 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform duration-state-change"
                >
                  {waveMode && isPlaying ? (
                    <Pause size={28} fill="currentColor" />
                  ) : (
                    <Play size={28} fill="currentColor" className="ml-1" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-gutter-xs">
              <h1 className="font-display text-display-lg-mobile text-dark-on-surface text-balance">
                Моя Волна
              </h1>
              <p className="font-body text-body-sm text-muted text-pretty max-w-xs">
                Живой поток музыки под ваш текущий ритм
              </p>
            </div>

            {/* Swipeable Mood Chips */}
            <div className="w-full overflow-x-auto no-scrollbar -mx-page-margin px-page-margin">
              <div className="inline-flex items-center gap-gutter-sm" role="group" aria-label="Настроение потока">
                {MOOD_CHIPS.map((chip) => {
                  const isPressed = Boolean(
                    waveMode &&
                      waveSettings &&
                      ((chip.opt.mood && waveSettings.mood === chip.opt.mood) ||
                        (chip.opt.activity && waveSettings.activity === chip.opt.activity) ||
                        (chip.opt.character && waveSettings.character === chip.opt.character))
                  );

                  return (
                    <button
                      key={chip.label}
                      type="button"
                      aria-pressed={isPressed}
                      onClick={() => {
                        if (isPressed) {
                          startWave();
                        } else {
                          startCustomWave(chip.opt);
                        }
                      }}
                      className={`inline-flex items-center px-gutter-lg py-gutter-sm rounded-full border shrink-0 transition-colors duration-state-change ${
                        isPressed
                          ? 'bg-accent/15 text-dark-primary border-accent font-semibold shadow-sm'
                          : 'bg-dark-surface-container-low text-dark-on-surface border-dark-outline-variant hover:border-dark-on-surface/40'
                      }`}
                    >
                      <span className="font-label text-label-md">{chip.label}</span>
                    </button>
                  );
                })}
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
              {/* Tall Feature Card: Премьера */}
              {premierePlaylist ? (
                <article
                  onClick={() => handleSelectPlaylist(premierePlaylist)}
                  className="rounded-xl bg-dark-surface-container-low p-gutter-md flex flex-col justify-between gap-gutter-md border border-dark-outline-variant cursor-pointer active:scale-[0.98] transition-transform duration-state-change"
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-dark-surface-container shadow-sm">
                    {premierePlaylist.cover_uri ? (
                      <img
                        src={formatCoverUrl(premierePlaylist.cover_uri, '400x400')}
                        alt={premierePlaylist.title}
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
                      <span className="font-label text-label-sm text-accent">Новинки</span>
                      <h3 className="font-headline text-title-lg text-dark-on-surface truncate">
                        {premierePlaylist.title}
                      </h3>
                      <span className="font-mono text-mono-sm text-muted tabular-nums">
                        {premierePlaylist.track_count || 20} треков
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleQuickPlayPlaylist(e, premierePlaylist)}
                      aria-label="Слушать Премьеру"
                      className="shrink-0 w-9 h-9 rounded-full bg-dark-on-surface text-dark-surface flex items-center justify-center active:scale-95 transition-transform duration-state-change shadow-md"
                    >
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                </article>
              ) : null}

              {/* Stacked Right Column: Дежавю + Микс дня */}
              <div className="flex flex-col gap-gutter-md">
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
                      <h3 className="font-headline text-title-md text-dark-on-surface truncate">
                        {dejavuPlaylist.title}
                      </h3>
                      <span className="font-mono text-label-sm text-muted tabular-nums">
                        {dejavuPlaylist.track_count || 30} треков
                      </span>
                    </div>
                  </article>
                )}

                {dailyMixPlaylist && (
                  <article
                    onClick={() => handleSelectPlaylist(dailyMixPlaylist)}
                    className="flex-1 rounded-xl bg-dark-surface-container-low p-gutter-md flex items-center gap-gutter-md border border-dark-outline-variant cursor-pointer active:scale-[0.98] transition-transform duration-state-change"
                  >
                    {dailyMixPlaylist.cover_uri ? (
                      <img
                        src={formatCoverUrl(dailyMixPlaylist.cover_uri, '200x200')}
                        alt={dailyMixPlaylist.title}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-dark-surface-container shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-dark-surface-container flex items-center justify-center shrink-0 text-accent">
                        <Sparkles size={24} />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-headline text-title-md text-dark-on-surface truncate">
                        {dailyMixPlaylist.title}
                      </h3>
                      <span className="font-label text-label-sm text-accent">Обновлён</span>
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
          {/* HERO: Моя Волна */}
          <section className="mb-9 p-6 rounded-2xl bg-gradient-to-r from-dark-surface-container via-dark-surface-container-low to-dark-surface border border-dark-outline-variant flex items-center justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => startWave()}
                className="w-14 h-14 rounded-full bg-accent text-light-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0"
                title="Включить Мою Волну"
              >
                <Radio size={28} />
              </button>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display text-title-lg text-dark-on-surface">Моя Волна</h2>
                  {waveMode && isPlaying && (
                    <span className="text-label-sm font-bold bg-accent text-light-on-primary px-2 py-0.5 rounded-full">
                      Сейчас играет
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-muted max-w-lg mb-3">
                  Бесконечный поток музыки, который подстраивается под ваши вкусы и настроение.
                </p>

                {/* Mood Chips */}
                <div className="flex flex-wrap gap-2">
                  {MOOD_CHIPS.map((chip) => {
                    const isActive = Boolean(
                      waveMode &&
                        waveSettings &&
                        ((chip.opt.mood && waveSettings.mood === chip.opt.mood) ||
                          (chip.opt.activity && waveSettings.activity === chip.opt.activity) ||
                          (chip.opt.character && waveSettings.character === chip.opt.character))
                    );
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => startCustomWave(chip.opt)}
                        className={`px-3 py-1 rounded-full text-label-sm transition-colors border ${
                          isActive
                            ? 'bg-accent/15 text-dark-primary border-accent font-semibold'
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
