import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { SettingsPage } from '../pages/SettingsPage';

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useWindowStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 950,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={() => setSettingsOpen(false)}
    >
      <div
        style={{
          width: 760,
          maxWidth: '94vw',
          height: '84vh',
          backgroundColor: '#0f0f0f',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            height: 56,
            padding: '0 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
            Настройки
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#888888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Закрыть (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Settings Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SettingsPage />
        </div>
      </div>
    </div>
  );
}
