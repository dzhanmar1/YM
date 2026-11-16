import React from 'react';
import { Sliders, Sparkles, Radio } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useEqualizerStore } from '../../store/equalizerStore';
import { useWindowStore } from '../../store/windowStore';

interface MobileHeaderProps {
  currentTab: string;
  title?: string;
}

export function MobileHeader({ currentTab, title }: MobileHeaderProps) {
  const { waveMode, startWave, isPlaying } = usePlayerStore();
  const { setModalOpen: setEqOpen } = useEqualizerStore();
  const { setWaveSettingsOpen, setSettingsOpen } = useWindowStore();

  const getTabTitle = () => {
    if (title) return title;
    switch (currentTab) {
      case 'landing':
        return 'Главная';
      case 'collection':
        return 'Моя коллекция';
      case 'search':
        return 'Поиск';
      default:
        return 'YM';
    }
  };

  return (
    <header
      style={{
        paddingTop: 'calc(var(--sat) + 10px)',
        paddingBottom: 10,
        paddingLeft: 16,
        paddingRight: 16,
        backgroundColor: '#050505',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Brand & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            backgroundColor: '#ffffff',
            color: '#000000',
            fontWeight: 900,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: -0.5,
          }}
        >
          YM
        </div>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: -0.3,
          }}
        >
          {getTabTitle()}
        </span>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Quick Wave Launcher */}
        <button
          onClick={() => {
            if (waveMode) {
              setWaveSettingsOpen(true);
            } else {
              startWave();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            backgroundColor: waveMode ? '#ffffff' : '#141414',
            color: waveMode ? '#000000' : '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Radio size={13} className={waveMode && isPlaying ? 'animate-pulse' : ''} />
          <span>{waveMode ? 'Волна' : 'Вкл. волну'}</span>
        </button>

        {/* Quick Equalizer */}
        <button
          onClick={() => setEqOpen(true)}
          title="Эквалайзер"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#141414',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Sliders size={14} />
        </button>
      </div>
    </header>
  );
}
