import React from 'react';
import { X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface MiniWavePanelProps {
  meta: {
    waveMode: boolean;
    waveStationId: string;
    waveModeId?: string;
  };
  onClose: () => void;
  sendAction: (action: string, payload?: any) => void;
}

export function MiniWavePanel({ meta, onClose, sendAction }: MiniWavePanelProps) {
  const handleDrag = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.mp-nodrag, button, input')) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  return (
    <div className="mp-expanded-view">
      <div className="mp-panel-header mp-drag" data-tauri-drag-region onMouseDown={handleDrag}>
        <span>НАСТРОЙКИ МОЕЙ ВОЛНЫ</span>
        <button
          className="mp-panel-close mp-nodrag"
          onClick={onClose}
          title="Закрыть"
        >
          <X size={12} />
        </button>
      </div>

      <div className="mp-wave-body mp-nodrag" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* НАСТРОЕНИЕ */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#888', marginBottom: 5, textTransform: 'uppercase' }}>
            НАСТРОЕНИЕ
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {[
              { id: 'fun', label: 'ВЕСЕЛОЕ' },
              { id: 'active', label: 'БОДРОЕ' },
              { id: 'calm', label: 'СПОКОЙНОЕ' },
              { id: 'sad', label: 'ГРУСТНОЕ' },
            ].map((item) => {
              const isCur =
                meta.waveMode && (meta.waveModeId ?? '').includes(`mood:${item.id}`);
              return (
                <button
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    backgroundColor: isCur ? '#ffffff' : '#121212',
                    color: isCur ? '#000000' : '#cccccc',
                    border: isCur ? '1px solid #ffffff' : '1px solid #242424',
                    borderRadius: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: isCur ? 900 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onClick={() => {
                    sendAction('start_custom_wave', { mood: item.id });
                    onClose();
                  }}
                >
                  <span>{isCur ? `[ • ] ${item.label}` : item.label}</span>
                  <span style={{ opacity: isCur ? 1 : 0.4 }}>→</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ХАРАКТЕР */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#888', marginBottom: 5, textTransform: 'uppercase' }}>
            ХАРАКТЕР
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {[
              { id: 'favorite', label: 'ЛЮБИМОЕ' },
              { id: 'discover', label: 'НЕЗНАКОМОЕ' },
              { id: 'popular', label: 'ПОПУЛЯРНОЕ' },
            ].map((item) => {
              const isCur =
                meta.waveMode && (meta.waveModeId ?? '').includes(`character:${item.id}`);
              return (
                <button
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    backgroundColor: isCur ? '#ffffff' : '#121212',
                    color: isCur ? '#000000' : '#cccccc',
                    border: isCur ? '1px solid #ffffff' : '1px solid #242424',
                    borderRadius: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: isCur ? 900 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onClick={() => {
                    sendAction('start_custom_wave', { character: item.id });
                    onClose();
                  }}
                >
                  <span>{isCur ? `[ • ] ${item.label}` : item.label}</span>
                  <span style={{ opacity: isCur ? 1 : 0.4 }}>→</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ЗАНЯТИЕ */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#888', marginBottom: 5, textTransform: 'uppercase' }}>
            ЗАНЯТИЕ
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {[
              { id: 'work-background', label: 'РАБОТА' },
              { id: 'workout', label: 'СПОРТ' },
              { id: 'driving', label: 'ДОРОГА' },
              { id: 'fall-asleep', label: 'ОТДЫХ' },
            ].map((item) => {
              const isCur =
                meta.waveMode && meta.waveModeId === `activity:${item.id}`;
              return (
                <button
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    backgroundColor: isCur ? '#ffffff' : '#121212',
                    color: isCur ? '#000000' : '#cccccc',
                    border: isCur ? '1px solid #ffffff' : '1px solid #242424',
                    borderRadius: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: isCur ? 900 : 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onClick={() => {
                    sendAction('start_custom_wave', { activity: item.id });
                    onClose();
                  }}
                >
                  <span>{isCur ? `[ • ] ${item.label}` : item.label}</span>
                  <span style={{ opacity: isCur ? 1 : 0.4 }}>→</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mp-panel-footer mp-nodrag">
        <span style={{ color: '#888' }}>ВЫБЕРИТЕ РЕЖИМ ДЛЯ МОМЕНТАЛЬНОГО ПЕРЕКЛЮЧЕНИЯ</span>
      </div>
    </div>
  );
}
