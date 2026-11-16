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
} from 'lucide-react';
import * as api from '../api';
import { useAuthStore } from '../store/authStore';
import { useWindowStore } from '../store/windowStore';
import { useEqualizerStore } from '../store/equalizerStore';
import { usePlayerStore } from '../store/playerStore';
import { useIsMobile } from '../hooks/useIsMobile';
import type { CacheStats, AudioQuality } from '../types';

export function SettingsPage() {
  const isMobile = useIsMobile();
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
    { keys: ['Esc'], action: 'Закрыть модальные окна / студию' },
  ];

  return (
    <div style={{
      height: '100%',
      padding: isMobile ? '20px 16px 140px' : '36px 40px',
      overflowY: 'auto',
      maxWidth: 760,
    }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
          Настройки
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Параметры аккаунта, аудио-прокси, горячие клавиши и управление поведением приложения
        </p>
      </div>

      {/* Account Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ShieldCheck size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Аккаунт Яндекс
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {status?.name || status?.login || 'Пользователь'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              UID: {status?.uid || '—'}
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#666666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-medium)';
            }}
          >
            <LogOut size={14} />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Audio Quality & Equalizer Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Качество звука и эквалайзер
            </h2>
          </div>

          <button
            onClick={() => setEqModalOpen(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#1c1c1c',
              border: '1px solid #333',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#282828';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1c1c1c';
            }}
          >
            Открыть эквалайзер
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Выберите предпочтительное качество входящего аудиопотока при загрузке с серверов Яндекс Музыки.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'hq_320', title: 'Высокое качество (HQ 320 kbps / FLAC)', desc: 'Кристально чистый звук без компромиссов' },
            { id: 'medium_192', title: 'Оптимальное (192 kbps)', desc: 'Стандартный баланс скорости и детализации' },
            { id: 'low_128', title: 'Экономия трафика (128 kbps)', desc: 'Минимальный объем данных и быстрый запуск' },
          ].map((q) => {
            const isSelected = audioQuality === q.id;
            return (
              <div
                key={q.id}
                onClick={() => setAudioQuality(q.id as AudioQuality)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected ? '#181818' : 'var(--bg-active)',
                  border: '1px solid',
                  borderColor: isSelected ? '#ffffff' : 'var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                    {q.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {q.desc}
                  </div>
                </div>

                {isSelected && <Check size={16} color="#ffffff" strokeWidth={3} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keyboard Shortcuts Section (Desktop only) */}
      {!isMobile && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Keyboard size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Горячие клавиши (Keyboard Shortcuts)
            </h2>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Горячие клавиши работают в основном окне приложения при активном фокусе (и автоматически отключаются при вводе текста в поиске).
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 10,
          }}>
            {shortcuts.map((sc, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-active)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {sc.action}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {sc.keys.map((k, ki) => (
                    <kbd
                      key={ki}
                      style={{
                        padding: '3px 7px',
                        backgroundColor: '#202020',
                        border: '1px solid #383838',
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                  {sc.alt && (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>или</span>
                      <kbd
                        style={{
                          padding: '3px 7px',
                          backgroundColor: '#202020',
                          border: '1px solid #383838',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          color: '#ffffff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                        }}
                      >
                        {sc.alt}
                      </kbd>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Application Behavior Section (Desktop only) */}
      {!isMobile && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Monitor size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Поведение приложения
            </h2>
          </div>

          <div
            onClick={() => setCloseToTray(!closeToTray)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-active)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Сворачивать в трей при закрытии окна
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                При нажатии на крестик окно сворачивается в системный трей Windows, не прерывая воспроизведение музыки
              </div>
            </div>

            <div style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              backgroundColor: closeToTray ? '#ffffff' : '#2a2a2a',
              position: 'relative',
              transition: 'background-color 0.2s ease',
              flexShrink: 0,
              marginLeft: 16,
            }}>
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: closeToTray ? '#0a0a0a' : '#666666',
                position: 'absolute',
                top: 3,
                left: closeToTray ? 23 : 3,
                transition: 'left 0.2s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* External Integrations (RedWatch Bridge) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Radio size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Внешние интеграции (RedWatch Bridge)
          </h2>
        </div>

        <div
          onClick={() => setRedWatchEnabled(!redWatchEnabled)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-active)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Синхронизация с RedWatch / внешним агентом
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Передаёт статус трека и принимает команды управления на порту 8765. Отключите, если у вас не запущено приложение RedWatch.
            </div>
          </div>

          <div style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            backgroundColor: redWatchEnabled ? '#ffffff' : '#2a2a2a',
            position: 'relative',
            transition: 'background-color 0.2s ease',
            flexShrink: 0,
            marginLeft: 16,
          }}>
            <div style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: redWatchEnabled ? '#0a0a0a' : '#666666',
              position: 'absolute',
              top: 3,
              left: redWatchEnabled ? 23 : 3,
              transition: 'left 0.2s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Playback History Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <History size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            История воспроизведения
          </h2>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Приложение сохраняет последние прослушанные треки для быстрого доступа и восстановления контекста.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-active)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {history.length > 0 ? `${history.length} недавних треков сохранено` : 'История воспроизведения пуста'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Хранится локально в кэше текущей сессии
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            disabled={history.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: history.length === 0 ? 'default' : 'pointer',
              opacity: history.length === 0 ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {historyCleared ? (
              <>
                <Check size={14} color="#ffffff" />
                <span>Очищено</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Очистить историю</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Disk Cache Section */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Database size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Локальный аудио-кэш и хранилище
          </h2>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Каждый прослушанный трек автоматически сохраняется во встроенный кэш приложения. При повторном воспроизведении трек мгновенно отдается через локальный HTTP стриминг-прокси с диска без расхода интернет-трафика.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-active)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {cacheStats ? `${cacheStats.count} треков сохранено` : 'Загрузка статистики...'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              Размер на диске: {cacheStats?.formatted_size || '0 байт'} • SQLite DB подключена
            </div>
          </div>

          <button
            onClick={handleClearCache}
            disabled={clearing || (cacheStats?.count === 0)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: clearing || cacheStats?.count === 0 ? 'default' : 'pointer',
              opacity: cacheStats?.count === 0 ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {cleared ? (
              <>
                <Check size={14} color="#ffffff" />
                <span>Очищено</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>{clearing ? 'Очистка...' : 'Очистить кэш'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Technology & Version Stack */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        fontSize: 12,
        color: 'var(--text-muted)',
        lineHeight: 1.6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Info size={14} />
            <span>Спецификация клиента</span>
          </div>
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 4,
            backgroundColor: '#1f1f1f',
            color: '#aaaaaa',
            fontFamily: 'var(--font-mono)',
          }}>
            YM Desktop v0.1.0 Beta
          </span>
        </div>
        <div>• Ядро: Rust 2021 + Tauri v2</div>
        <div>• API Яндекс Музыки: yandex-music v0.7.0 (Vyfor)</div>
        <div>• Стриминг: Встроенный локальный HTTP прокси-сервер на базе Axum & Tokio с поддержкой Range-запросов</div>
        <div>• Караоке: Парсер таймкодов LRC с точностью до миллисекунд</div>
        <div>• База данных: SQLite3 (rusqlite) для токенов, настроек и индекса кэша</div>
      </div>
    </div>
  );
}
