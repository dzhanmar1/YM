import React from 'react';
import { X, ExternalLink, Play, Pause } from 'lucide-react';
import { formatDuration, EqualizerPreset } from '../../types';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const EQ_PRESET_LIST: { id: EqualizerPreset; label: string }[] = [
  { id: 'flat', label: 'ОБЫЧНЫЙ' },
  { id: 'bass_boost', label: 'БАС ++' },
  { id: 'vocal_boost', label: 'ВОКАЛ' },
  { id: 'rock', label: 'РОК' },
  { id: 'electronic', label: 'ЭЛЕКТРО' },
  { id: 'chill', label: 'РЕЛАКС' },
  { id: 'acoustic', label: 'АКУСТИКА' },
];

interface MiniEqPanelProps {
  eqPreset: string;
  isPlaying: boolean;
  titleDisplay: string;
  currentTime: number;
  duration: number;
  onClose: () => void;
  onTogglePlay: () => void;
  sendAction: (action: string, payload?: any) => void;
}

export function MiniEqPanel({
  eqPreset,
  isPlaying,
  titleDisplay,
  currentTime,
  duration,
  onClose,
  onTogglePlay,
  sendAction,
}: MiniEqPanelProps) {
  const handleDrag = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.mp-nodrag, button, input')) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  return (
    <div className="mp-expanded-view">
      {/* Header */}
      <div className="mp-panel-header mp-drag" data-tauri-drag-region onMouseDown={handleDrag}>
        <span>ПРЕСЕТЫ ЭКВАЛАЙЗЕРА</span>
        <button
          className="mp-panel-close mp-nodrag"
          onClick={onClose}
          title="Закрыть"
        >
          <X size={12} />
        </button>
      </div>

      {/* Presets Grid */}
      <div className="mp-eq-grid mp-nodrag">
        {EQ_PRESET_LIST.map((p) => (
          <button
            key={p.id}
            className={`mp-eq-btn ${eqPreset === p.id ? 'active' : ''}`}
            onClick={() => sendAction('set_eq_preset', p.id)}
          >
            <span>{p.label}</span>
            {eqPreset === p.id && <span>✓</span>}
          </button>
        ))}

        <button
          className="mp-eq-full-link"
          onClick={() => sendAction('open_eq_full')}
        >
          ОТКРЫТЬ 10-ПОЛОСНЫЙ ЭКВАЛАЙЗЕР <ExternalLink size={10} />
        </button>
      </div>

      {/* Sleek Minimal Footer */}
      <div className="mp-panel-footer mp-nodrag">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="mp-panel-footer-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? (
              <Pause size={10} fill="#ffffff" color="#ffffff" />
            ) : (
              <Play size={10} fill="#ffffff" color="#ffffff" />
            )}
          </button>
          <span style={{ color: '#aaa', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titleDisplay}
          </span>
        </div>
        <span>{formatDuration(currentTime * 1000)} / {formatDuration(duration * 1000)}</span>
      </div>
    </div>
  );
}
