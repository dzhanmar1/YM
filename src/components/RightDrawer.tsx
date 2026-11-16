import React, { useEffect, useRef, useState } from 'react';
import { X, Mic2, ListMusic, Trash2, GripVertical, ChevronUp, ChevronDown, Disc } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { formatDuration } from '../types';

export function RightDrawer() {
  const { sideDrawer, setSideDrawer } = useWindowStore();
  const { currentTrack, queue, queueIndex, playTrack, moveQueueItem, removeFromQueue, seek } = usePlayerStore();
  const { lyrics, activeLineIndex } = useLyricsStore();

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drag and drop state for queue
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (sideDrawer === 'lyrics' && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, sideDrawer]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sideDrawer) {
        setSideDrawer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sideDrawer, setSideDrawer]);

  if (!sideDrawer) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 50,
        bottom: 76,
        right: 0,
        width: 400,
        maxWidth: '90vw',
        backgroundColor: '#0a0a0a',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.7)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 52,
          padding: '0 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {/* Tab switchers */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          <button
            onClick={() => setSideDrawer('lyrics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: sideDrawer === 'lyrics' ? '#ffffff' : 'transparent',
              color: sideDrawer === 'lyrics' ? '#000000' : '#aaaaaa',
              fontSize: 12,
              fontWeight: sideDrawer === 'lyrics' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Mic2 size={13} />
            <span>Текст песни</span>
          </button>

          <button
            onClick={() => setSideDrawer('queue')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: sideDrawer === 'queue' ? '#ffffff' : 'transparent',
              color: sideDrawer === 'queue' ? '#000000' : '#aaaaaa',
              fontSize: 12,
              fontWeight: sideDrawer === 'queue' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ListMusic size={13} />
            <span>Очередь</span>
            {queue.length > 0 && <span style={{ opacity: 0.6, fontSize: 11 }}>({queue.length})</span>}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setSideDrawer(null)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: 'none',
            backgroundColor: 'transparent',
            color: '#888888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#888888';
          }}
          title="Закрыть панель (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body: Lyrics */}
      {sideDrawer === 'lyrics' && (
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 24px 60px',
            position: 'relative',
          }}
        >
          {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {lyrics.lines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                const isPast = idx < activeLineIndex;
                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      if (line.time_ms !== undefined) seek(line.time_ms / 1000);
                    }}
                    style={{
                      cursor: 'pointer',
                      fontSize: isActive ? 18 : 15,
                      fontWeight: isActive ? 800 : 500,
                      color: isActive ? '#ffffff' : isPast ? '#777777' : '#444444',
                      lineHeight: 1.4,
                      transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                      padding: '6px 10px',
                      borderRadius: 8,
                      backgroundColor: isActive ? 'rgba(163, 2, 26, 0.22)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = isPast ? '#777777' : '#444444';
                    }}
                  >
                    {line.text}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666666' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Mic2 size={22} color="#666666" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                Текст не найден
              </div>
              <p style={{ fontSize: 13, color: '#888888', maxWidth: 280, margin: '0 auto' }}>
                Для текущего трека синхронизированный текст песни пока отсутствует в базе.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Body: Queue */}
      {sideDrawer === 'queue' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 60px',
            position: 'relative',
          }}
        >
          {queue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666666' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ListMusic size={22} color="#666666" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                Очередь воспроизведения пуста
              </div>
              <p style={{ fontSize: 13, color: '#888888', maxWidth: 280, margin: '0 auto' }}>
                Включите любой трек или плейлист, и они добавятся в очередь.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {queue.map((track, idx) => {
                const isCurrent = idx === queueIndex;
                const isDragging = draggedIdx === idx;
                const isDragTarget = dragOverIdx === idx && draggedIdx !== idx;

                return (
                  <div
                    key={`${track.id}-${idx}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedIdx(idx);
                      e.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceIndex = draggedIdx !== null ? draggedIdx : Number(e.dataTransfer.getData('text/plain'));
                      if (!isNaN(sourceIndex) && sourceIndex !== idx) {
                        moveQueueItem(sourceIndex, idx);
                      }
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    onClick={() => playTrack(track, queue, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      backgroundColor: isCurrent
                        ? 'rgba(163, 2, 26, 0.18)'
                        : isDragTarget
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'transparent',
                      borderLeft: isCurrent ? '3px solid #a3021a' : '3px solid transparent',
                      borderTop: isDragTarget ? '2px solid #ffffff' : 'none',
                      opacity: isDragging ? 0.3 : 1,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <span
                        style={{ color: '#555555', cursor: 'grab', display: 'flex', alignItems: 'center' }}
                        title="Перетащить"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={13} />
                      </span>

                      <span style={{ fontSize: 11, color: isCurrent ? '#a3021a' : '#666666', fontWeight: 800, width: 20 }}>
                        {idx + 1}
                      </span>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: isCurrent ? 700 : 500,
                            color: isCurrent ? '#ffffff' : '#dddddd',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {track.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#888888',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {track.artists.join(', ')}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => removeFromQueue(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#666666',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}
                        title="Удалить из очереди"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
