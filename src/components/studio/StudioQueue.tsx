import React, { useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { formatDuration } from '../../types';
import type { TrackItem } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface StudioQueueProps {
  queue: TrackItem[];
  queueIndex: number;
  onPlayTrack: (track: TrackItem, queue: TrackItem[], index: number) => void;
}

export function StudioQueue({ queue, queueIndex, onPlayTrack }: StudioQueueProps) {
  const { moveQueueItem, removeFromQueue } = usePlayerStore();
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
      moveQueueItem(sourceIndex, targetIndex);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px 60px 32px',
        position: 'relative',
      }}
    >
      {queue.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: '#666666',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <span>Порядок треков (перетаскивайте или используйте стрелки)</span>
          <span>{queue.length} ТРЕКОВ</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {queue.length > 0 ? (
          queue.map((track, idx) => {
            const isCurrent = idx === queueIndex;
            const isDragging = draggedIdx === idx;
            const isDragTarget = dragOverIdx === idx && draggedIdx !== idx;

            return (
              <div
                key={`${track.id}-${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={() => handleDragLeave(idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: isCurrent ? '#161616' : 'transparent',
                  border: '1px solid',
                  borderColor: isDragTarget ? '#ffffff' : isCurrent ? '#333333' : 'transparent',
                  borderTop: isDragTarget ? '2px solid #ffffff' : undefined,
                  borderRadius: 2,
                  cursor: 'pointer',
                  opacity: isDragging ? 0.4 : 1,
                  transition: 'background-color 0.1s ease, border-color 0.1s ease',
                }}
                className="studio-queue-row"
                onClick={() => onPlayTrack(track, queue, idx)}
              >
                {/* Left info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      cursor: 'grab',
                      color: '#555555',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Перетащить трек"
                  >
                    <GripVertical size={13} />
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: isCurrent ? '#ffffff' : '#555555',
                      width: 18,
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: isCurrent ? '#ffffff' : '#cccccc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textTransform: 'uppercase',
                      }}
                    >
                      {track.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: '#666666',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {track.artists.join(', ')}
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Reorder Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      disabled={idx === 0}
                      onClick={() => moveQueueItem(idx, idx - 1)}
                      title="Переместить выше"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: idx === 0 ? '#333333' : '#777777',
                        cursor: idx === 0 ? 'default' : 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      disabled={idx === queue.length - 1}
                      onClick={() => moveQueueItem(idx, idx + 1)}
                      title="Переместить ниже"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: idx === queue.length - 1 ? '#333333' : '#777777',
                        cursor: idx === queue.length - 1 ? 'default' : 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      title="Удалить из очереди"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#666666',
                        cursor: 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: '#555555',
                      width: 36,
                      textAlign: 'right',
                    }}
                  >
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              color: '#555555',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              textAlign: 'center',
              marginTop: 40,
            }}
          >
            Очередь воспроизведения пуста
          </div>
        )}
      </div>
    </div>
  );
}
