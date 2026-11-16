import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Search,
  X,
  Minus,
  Square,
  Copy,
  Radio,
  Sliders,
  Minimize2,
  Settings,
  Sparkles,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useEqualizerStore } from '../store/equalizerStore';
import { useWindowStore } from '../store/windowStore';
import { invoke } from '@tauri-apps/api/core';

export type AppTab = 'landing' | 'collection' | 'search';

interface TitleBarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TitleBar({
  currentTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const { waveMode, isPlaying } = usePlayerStore();
  const { setModalOpen: setEqOpen } = useEqualizerStore();
  const { setWaveSettingsOpen, setSettingsOpen } = useWindowStore();

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    try {
      const win = getCurrentWindow();
      const checkMax = () => {
        win.isMaximized().then(setIsMaximized).catch(() => {});
      };
      checkMax();
      win.onResized(() => {
        checkMax();
      }).then((fn) => {
        unlisten = fn;
      }).catch(() => {});
    } catch {}

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {
      console.warn(e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      const max = await win.isMaximized();
      setIsMaximized(max);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      const { closeToTray } = useWindowStore.getState();
      if (closeToTray) {
        await win.hide();
      } else {
        await win.close();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleShowMini = async () => {
    try {
      await invoke('cmd_show_mini_player');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
      onMouseDown={(e) => {
        if (e.button === 0 && e.detail === 1) {
          const target = e.target as HTMLElement;
          if (!target.closest('button, input, [role="button"], a')) {
            getCurrentWindow().startDragging().catch(() => {});
          }
        }
      }}
      style={{
        height: 50,
        backgroundColor: '#0a0a0a',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 0 16px',
        flexShrink: 0,
        zIndex: 50,
        userSelect: 'none',
      }}
    >
      {/* LEFT: Branding & Main Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} data-tauri-drag-region>
        {/* Brand Logo & Name */}
        <div
          data-tauri-drag-region
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'default',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: '#a3021a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 13,
              letterSpacing: -0.5,
              boxShadow: '0 2px 10px rgba(163, 2, 26, 0.4)',
            }}
          >
            YM
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.01em',
            }}
          >
            Музыка
          </span>
        </div>

        {/* Clean Nav Pills */}
        <nav
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
            onClick={() => onSelectTab('landing')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: currentTab === 'landing' ? '#ffffff' : 'transparent',
              color: currentTab === 'landing' ? '#000000' : '#aaaaaa',
              fontSize: 12,
              fontWeight: currentTab === 'landing' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Главная
          </button>
          <button
            onClick={() => onSelectTab('collection')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: currentTab === 'collection' ? '#ffffff' : 'transparent',
              color: currentTab === 'collection' ? '#000000' : '#aaaaaa',
              fontSize: 12,
              fontWeight: currentTab === 'collection' ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Моя коллекция
          </button>
        </nav>
      </div>

      {/* CENTER: Integrated Search Bar */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          maxWidth: 420,
          margin: '0 20px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: 32,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <Search size={14} color="#888888" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Трек, исполнитель или плейлист..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (currentTab !== 'search' && e.target.value.trim().length > 0) {
                onSelectTab('search');
              }
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0 && currentTab !== 'search') {
                onSelectTab('search');
              }
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: 12,
              minWidth: 0,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('');
                if (currentTab === 'search') onSelectTab('landing');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888888',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Очистить поиск"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: Quick Action Icons & Custom Windows Controls */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {/* Quick Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
          {/* Wave Settings Quick Button */}
          <button
            onClick={() => setWaveSettingsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: waveMode ? 'rgba(163, 2, 26, 0.25)' : 'transparent',
              color: waveMode ? '#ffffff' : '#aaaaaa',
              border: waveMode ? '1px solid #a3021a' : '1px solid transparent',
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            title="Настройки Моей Волны"
          >
            <Radio size={13} />
            <span>Волна</span>
          </button>

          {/* Equalizer */}
          <button
            onClick={() => setEqOpen(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              color: '#aaaaaa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#aaaaaa'; }}
            title="Эквалайзер"
          >
            <Sliders size={14} />
          </button>

          {/* Mini Player */}
          <button
            onClick={handleShowMini}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              color: '#aaaaaa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#aaaaaa'; }}
            title="Мини-плеер поверх окон"
          >
            <Minimize2 size={14} />
          </button>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              color: '#aaaaaa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#aaaaaa'; }}
            title="Настройки"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Custom Window Buttons (Minimize, Maximize/Restore, Close) */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <button
            onClick={handleMinimize}
            style={{
              width: 44,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#888888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Свернуть"
          >
            <Minus size={14} />
          </button>

          <button
            onClick={handleToggleMaximize}
            style={{
              width: 44,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#888888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title={isMaximized ? 'Восстановить' : 'Развернуть'}
          >
            {isMaximized ? <Copy size={12} /> : <Square size={12} />}
          </button>

          <button
            onClick={handleClose}
            style={{
              width: 46,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#888888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e81123';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#888888';
            }}
            title="Закрыть"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
