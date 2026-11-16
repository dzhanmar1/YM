import React from 'react';
import { Home, Radio, Search, Heart, Settings } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useWindowStore } from '../../store/windowStore';

export type MobileTab = 'landing' | 'collection' | 'search';

interface BottomNavProps {
  currentTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const { waveMode, startWave, isPlaying } = usePlayerStore();
  const { setWaveSettingsOpen, setSettingsOpen } = useWindowStore();

  const handleWaveClick = () => {
    if (!waveMode) {
      startWave();
    } else {
      setWaveSettingsOpen(true);
    }
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--mobile-bottom-nav-height) + var(--sab))',
        paddingBottom: 'var(--sab)',
        backgroundColor: 'rgba(10, 10, 10, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
        zIndex: 40,
        userSelect: 'none',
      }}
    >
      {/* 1. Главная */}
      <button
        type="button"
        onClick={() => onSelectTab('landing')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: 'pointer',
          color: currentTab === 'landing' ? '#ffffff' : '#666666',
          padding: '6px 0',
          transition: 'color 0.12s',
        }}
      >
        <Home size={20} strokeWidth={currentTab === 'landing' ? 2.4 : 1.8} />
        <span style={{ fontSize: 10, fontWeight: currentTab === 'landing' ? 700 : 500 }}>
          Главная
        </span>
      </button>

      {/* 2. Моя волна */}
      <button
        type="button"
        onClick={handleWaveClick}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: 'pointer',
          color: waveMode ? '#ffffff' : '#666666',
          padding: '6px 0',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Radio size={20} strokeWidth={waveMode ? 2.5 : 1.8} />
          {waveMode && isPlaying && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 0 8px rgba(255,255,255,0.8)',
              }}
            />
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: waveMode ? 700 : 500 }}>
          Волна
        </span>
      </button>

      {/* 3. Поиск */}
      <button
        type="button"
        onClick={() => onSelectTab('search')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: 'pointer',
          color: currentTab === 'search' ? '#ffffff' : '#666666',
          padding: '6px 0',
          transition: 'color 0.12s',
        }}
      >
        <Search size={20} strokeWidth={currentTab === 'search' ? 2.4 : 1.8} />
        <span style={{ fontSize: 10, fontWeight: currentTab === 'search' ? 700 : 500 }}>
          Поиск
        </span>
      </button>

      {/* 4. Коллекция */}
      <button
        type="button"
        onClick={() => onSelectTab('collection')}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: 'pointer',
          color: currentTab === 'collection' ? '#ffffff' : '#666666',
          padding: '6px 0',
          transition: 'color 0.12s',
        }}
      >
        <Heart size={20} strokeWidth={currentTab === 'collection' ? 2.4 : 1.8} />
        <span style={{ fontSize: 10, fontWeight: currentTab === 'collection' ? 700 : 500 }}>
          Коллекция
        </span>
      </button>

      {/* 5. Настройки */}
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          cursor: 'pointer',
          color: '#666666',
          padding: '6px 0',
          transition: 'color 0.12s',
        }}
      >
        <Settings size={20} strokeWidth={1.8} />
        <span style={{ fontSize: 10, fontWeight: 500 }}>
          Настройки
        </span>
      </button>
    </nav>
  );
}
