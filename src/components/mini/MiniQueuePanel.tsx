import React, { useState } from 'react';
import { X, Play, Pause, GripVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { formatDuration } from '../../types';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TrackSimple {
  id: string;
  title: string;
  artists?: string[];
}

interface MiniQueuePanelProps {
  queue: TrackSimple[];
  queueIndex: number;
  isPlaying: boolean;
  titleDisplay: string;
  currentTime: number;
  duration: number;
  onClose: () => void;
  onTogglePlay: () => void;
  sendAction: (action: string, payload?: any) => void;
}

export function MiniQueuePanel({
  queue,
  queueIndex,
  isPlaying,
  titleDisplay,
  currentTime,
  duration,
  onClose,
  onTogglePlay,
  sendAction,
}: MiniQueuePanelProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDrag = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.mp-nodrag, button, input')) {
      getCurrentWindow().startDragging().catch(() => {});
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIdx === index) {
      setDragOverIdx(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIdx !== null ? draggedIdx : Number(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      sendAction('move_queue_item', { from: sourceIndex, to: targetIndex });
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="mp-expanded-view">
      {/* Header */}
      <div className="mp-panel-header mp-drag" data-tauri-drag-region onMouseDown={handleDrag}>
        <span>ОЧЕРЕДЬ ВОСПРОИЗВЕДЕНИЯ ({queue.length})</span>
        <button
          className="mp-panel-close mp-nodrag"
          onClick={onClose}
          title="Закрыть"
        >
          <X size={12} />
        </button>
      </div>

      {/* Track List */}
      <div className="mp-queue-list mp-nodrag">
        {queue.length === 0 ? (
          <div style={{ color: '#555', padding: '30px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            ОЧЕРЕДЬ ПУСТА
          </div>
        ) : (
          queue.map((t, idx) => {
            const isCurrent = idx === queueIndex;
            const isDragging = draggedIdx === idx;
            const isDragTarget = dragOverIdx === idx && draggedIdx !== idx;

            return (
              <div
                key={`${t.id}-${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={() => handleDragLeave(idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`mp-queue-item ${isCurrent ? 'active' : ''}`}
                style={{
                  opacity: isDragging ? 0.35 : 1,
                  borderTop: isDragTarget ? '2px solid #ffffff' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onClick={() => sendAction('play_queue_index', idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <span
                    style={{ color: '#555', cursor: 'grab', display: 'flex', alignItems: 'center' }}
                    title="Перетащить"
                  >
                    <GripVertical size={11} />
                  </span>
                  <span className="mp-queue-idx">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="mp-queue-meta">
                    <span className="mp-queue-title">{t.title}</span>
                    <span className="mp-queue-artist">{t.artists?.join(', ')}</span>
                  </div>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    disabled={idx === 0}
                    onClick={() => sendAction('move_queue_item', { from: idx, to: idx - 1 })}
                    title="Выше"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: idx === 0 ? '#333' : '#777',
                      cursor: idx === 0 ? 'default' : 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    disabled={idx === queue.length - 1}
                    onClick={() => sendAction('move_queue_item', { from: idx, to: idx + 1 })}
                    title="Ниже"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: idx === queue.length - 1 ? '#333' : '#777',
                      cursor: idx === queue.length - 1 ? 'default' : 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={() => sendAction('remove_from_queue', idx)}
                    title="Удалить"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                  {isCurrent && <div className="mp-queue-dot" style={{ marginLeft: 4 }} />}
                </div>
              </div>
            );
          })
        )}
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
