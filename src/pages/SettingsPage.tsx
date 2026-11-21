import { useEffect, useState } from 'react';
import {
  Database,
  LogOut,
  Trash2,
  ShieldCheck,
  Check,
  Sliders,
  Keyboard,
  History,
  Monitor,
  Info,
  Radio,
  Download,
} from 'lucide-react';
import * as api from '../api';
import { isTauri } from '@tauri-apps/api/core';
import { useAuthStore } from '../store/authStore';
import { useWindowStore } from '../store/windowStore';
import { useEqualizerStore } from '../store/equalizerStore';
import { usePlayerStore } from '../store/playerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePwaInstall } from '../hooks/usePwaInstall';
import type { CacheStats, AudioQuality } from '../types';

export function SettingsPage() {
  const isMobile = useIsMobile();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const { status, logout } = useAuthStore();
  const {
    audioQuality,
    setAudioQuality,
    closeToTray,
    setCloseToTray,
    redWatchEnabled,
    setRedWatchEnabled,
  } = useWindowStore();
  const { setModalOpen: setEqModalOpen } = useEqualizerStore();
  const { history, clearHistory } = usePlayerStore();

  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const stats = await api.getCacheStats();
      setCacheStats(stats);
    } catch (e) {
      console.error('Failed to load cache stats:', e);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await api.clearCache();
      await loadStats();
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    } finally {
      setClearing(false);
    }
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistoryCleared(true);
    setTimeout(() => setHistoryCleared(false), 2000);
  };

  const shortcuts = [
    { keys: ['Пробел'], action: 'Воспроизведение / Пауза' },
    { keys: ['Shift', '→'], alt: 'N', action: 'Следующий трек' },
    { keys: ['Shift', '←'], alt: 'P', action: 'Предыдущий трек' },
    { keys: ['→'], action: 'Перемотка на 5 сек вперёд' },
    { keys: ['←'], action: 'Перемотка на 5 сек назад' },
    { keys: ['↑'], action: 'Увеличить громкость (+5%)' },
    { keys: ['↓'], action: 'Уменьшить громкость (-5%)' },
    { keys: ['L'], action: 'Поставить / снять лайк' },
    { keys: ['M'], action: 'Вкл / выкл звук (Mute)' },
    { keys: ['Esc'], action: 'Закрыть модальные окна' },
  ];

  return (
    <div
      className={`h-full flex flex-col gap-5 text-dark-on-surface select-none ${
        isMobile ? 'p-4 pb-36' : 'p-6'
      }`}
    >
      {/* Account Section */}
      <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-2 text-muted">
          <ShieldCheck size={16} className="text-accent" />
          <h2 className="font-label text-label-xs uppercase tracking-wider text-muted font-bold">
            Аккаунт Яндекс
          </h2>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="font-headline text-title-md text-dark-on-surface font-semibold truncate">
              {status?.name || status?.login || 'Пользователь'}
            </span>
            <span className="font-mono text-label-xs text-muted">
              UID: {status?.uid || '—'}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-dark-outline-variant text-muted hover:text-dark-on-surface bg-dark-surface-container text-label-sm active:scale-95 transition-all"
          >
            <LogOut size={14} />
            <span>Выйти</span>
          </button>
        </div>
      </section>

      {/* Audio Quality & Equalizer Section */}
      <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-accent" />
            <h2 className="font-label text-label-xs uppercase tracking-wider text-muted font-bold">
              Качество звука и эквалайзер
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setEqModalOpen(true)}
            className="px-3 py-1 rounded-lg bg-accent/15 border border-accent/40 text-accent font-label text-label-sm font-semibold active:scale-95 transition-all hover:bg-accent/25"
          >
            Эквалайзер
          </button>
        </div>

        <p className="font-body text-body-sm text-muted">
          Выберите предпочтительное качество входящего аудиопотока при загрузке с серверов Яндекс Музыки.
        </p>

        <div className="flex flex-col gap-2">
          {[
            {
              id: 'hq_320',
              title: 'Высокое качество (HQ 320 kbps / FLAC)',
              desc: 'Кристально чистый звук без компромиссов',
            },
            {
              id: 'medium_192',
              title: 'Оптимальное (192 kbps)',
              desc: 'Стандартный баланс скорости и детализации',
            },
            {
              id: 'low_128',
              title: 'Экономия трафика (128 kbps)',
              desc: 'Минимальный объем данных и быстрый запуск',
            },
          ].map((q) => {
            const isSelected = audioQuality === q.id;
            return (
              <div
                key={q.id}
                onClick={() => setAudioQuality(q.id as AudioQuality)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer active:scale-[0.99] transition-all ${
                  isSelected
                    ? 'bg-accent/15 border-accent text-dark-on-surface shadow-sm'
                    : 'bg-dark-surface-container/50 border-dark-outline-variant/40 text-muted hover:border-dark-on-surface/40'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span
                    className={`font-title text-title-sm truncate ${
                      isSelected ? 'text-accent font-semibold' : 'text-dark-on-surface'
                    }`}
                  >
                    {q.title}
                  </span>
                  <span className="font-body text-label-xs text-muted truncate">{q.desc}</span>
                </div>

                {isSelected && <Check size={16} className="text-accent shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Playback History Section */}
      <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <History size={16} className="text-accent" />
          <h2 className="font-label text-label-xs uppercase tracking-wider text-muted font-bold">
            История воспроизведения
          </h2>
        </div>

        <p className="font-body text-body-sm text-muted">
          Приложение сохраняет последние прослушанные треки для быстрого доступа и восстановления контекста.
        </p>

        <div className="flex items-center justify-between p-3 rounded-lg bg-dark-surface-container/50 border border-dark-outline-variant/40">
          <div className="flex flex-col min-w-0">
            <span className="font-title text-title-sm text-dark-on-surface truncate">
              {history.length > 0 ? `${history.length} треков сохранено` : 'История пуста'}
            </span>
            <span className="font-body text-label-xs text-muted truncate">
              Хранится локально в кэше текущей сессии
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearHistory}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-outline-variant text-muted hover:text-dark-on-surface bg-dark-surface-container text-label-sm active:scale-95 transition-all disabled:opacity-40"
          >
            {historyCleared ? (
              <>
                <Check size={14} className="text-accent" />
                <span className="text-accent">Очищено</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Очистить</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Disk Cache Section */}
      <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-accent" />
          <h2 className="font-label text-label-xs uppercase tracking-wider text-muted font-bold">
            Локальный аудио-кэш и хранилище
          </h2>
        </div>

        <p className="font-body text-body-sm text-muted">
          Каждый прослушанный трек автоматически сохраняется во встроенный кэш приложения. При повторном воспроизведении трек отдается через локальный HTTP стриминг-прокси с диска без расхода интернет-трафика.
        </p>

        <div className="flex items-center justify-between p-3 rounded-lg bg-dark-surface-container/50 border border-dark-outline-variant/40">
          <div className="flex flex-col min-w-0">
            <span className="font-title text-title-sm text-dark-on-surface truncate">
              {cacheStats ? `${cacheStats.count} треков сохранено` : 'Загрузка статистики...'}
            </span>
            <span className="font-mono text-label-xs text-muted truncate">
              Размер на диске: {cacheStats?.formatted_size || '0 байт'} • SQLite DB
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            disabled={clearing || cacheStats?.count === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-outline-variant text-muted hover:text-dark-on-surface bg-dark-surface-container text-label-sm active:scale-95 transition-all disabled:opacity-40"
          >
            {cleared ? (
              <>
                <Check size={14} className="text-accent" />
                <span className="text-accent">Очищено</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>{clearing ? 'Очистка...' : 'Очистить кэш'}</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* PWA Installation Card (Web mode) */}
      {(isInstallable || isInstalled) && (
        <section className="bg-dark-surface-container-low border border-accent/40 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Download size={16} className="text-accent" />
              <h2 className="font-label text-label-xs uppercase tracking-wider text-accent font-bold">
                {isInstalled ? 'Приложение установлено' : 'Установить приложение (PWA)'}
              </h2>
            </div>
            <p className="font-body text-body-sm text-muted">
              {isInstalled
                ? 'Вы используете автономную PWA версию YM на главном экране.'
                : 'Установите YM на главный экран или рабочий стол для быстрого запуска, фонового воспроизведения и управления с экрана блокировки.'}
            </p>
          </div>

          {isInstallable && (
            <button
              type="button"
              onClick={() => promptInstall()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-dark-surface font-headline font-bold text-label-sm shadow-md active:scale-95 transition-all shrink-0"
            >
              <Download size={14} />
              <span>Установить</span>
            </button>
          )}
        </section>
      )}

      {/* Desktop Only: Behavior & Hotkeys */}
      {!isMobile && (
        <>
          {/* Keyboard Shortcuts Section */}
          <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-5 flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <Keyboard size={16} className="text-accent" />
              <h2 className="font-label text-label-xs uppercase tracking-wider text-muted font-bold">
                Горячие клавиши
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((sc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-dark-surface-container/50 border border-dark-outline-variant/40"
                >
                  <span className="font-body text-body-sm text-muted">{sc.action}</span>
                  <div className="flex items-center gap-1">
                    {sc.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        className="px-2 py-0.5 rounded bg-dark-surface-container-high border border-dark-outline-variant font-mono text-[11px] text-dark-on-surface"
                      >
                        {k}
                      </kbd>
                    ))}
                    {sc.alt && (
                      <>
                        <span className="font-body text-[11px] text-muted">/</span>
                        <kbd className="px-2 py-0.5 rounded bg-dark-surface-container-high border border-dark-outline-variant font-mono text-[11px] text-dark-on-surface">
                          {sc.alt}
                        </kbd>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Behavior Section */}
          <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-5 flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <Monitor size={16} className="text-accent" />
              <h2 className="font-label text-label-xs uppercase tracking-wider text-muted font-bold">
                Поведение приложения
              </h2>
            </div>

            <div
              onClick={() => setCloseToTray(!closeToTray)}
              className="flex items-center justify-between p-3.5 rounded-lg bg-dark-surface-container/50 border border-dark-outline-variant/40 cursor-pointer"
            >
              <div>
                <span className="font-title text-title-sm text-dark-on-surface">
                  Сворачивать в трей при закрытии окна
                </span>
                <p className="font-body text-label-xs text-muted mt-0.5">
                  При нажатии на крестик окно сворачивается в системный трей Windows, не прерывая воспроизведение
                </p>
              </div>

              <div
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ml-4 ${
                  closeToTray ? 'bg-accent' : 'bg-dark-surface-container-highest'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-dark-on-surface absolute top-1 transition-transform ${
                    closeToTray ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>
          </section>
        </>
      )}

      {/* Technology & Version Stack */}
      <section className="bg-dark-surface-container-low border border-dark-outline-variant/40 rounded-xl p-4 sm:p-5 font-mono text-label-xs text-muted leading-relaxed flex flex-col gap-1.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 font-sans font-bold text-dark-on-surface text-label-sm">
            <Info size={14} className="text-accent" />
            <span>Спецификация клиента</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-dark-surface-container border border-dark-outline-variant text-accent font-mono text-[10px]">
            YM Desktop v0.2.0 Aura v2
          </span>
        </div>
        <div>• Ядро: Rust 2021 + Tauri v2 + React 19 + Tailwind v3.4</div>
        <div>• Дизайн-система: YM Aura v2 (Google Stitch)</div>
        <div>• API: yandex-music v0.7.0 + Axum Streaming Proxy</div>
        <div>• Аудио: Web Audio API Lossless + LRC Karaoke Stream</div>
      </section>
    </div>
  );
}
