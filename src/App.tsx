import { useEffect, useState, useCallback } from 'react';
import { TitleBar, AppTab } from './components/TitleBar';
import { PlayerBar } from './components/PlayerBar';
import { AudioEngine } from './components/AudioEngine';
import { RightDrawer } from './components/RightDrawer';
import { ImmersiveNowPlaying } from './components/ImmersiveNowPlaying';
import { EqualizerModal } from './components/EqualizerModal';
import { WaveSettingsModal } from './components/WaveSettingsModal';
import { SettingsModal } from './components/SettingsModal';
import { BottomNav } from './components/mobile/BottomNav';
import { MobileMiniPlayer } from './components/mobile/MobileMiniPlayer';
import { LandingPage } from './pages/LandingPage';
import { CollectionPage } from './pages/CollectionPage';
import { SearchPage } from './pages/SearchPage';
import { AuthModal } from './pages/AuthModal';
import { useAuthStore } from './store/authStore';
import { useEqualizerStore } from './store/equalizerStore';
import { useWindowStore } from './store/windowStore';
import { useIsMobile } from './hooks/useIsMobile';
import { Loader2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useRedWatchBridge } from './hooks/useRedWatchBridge';

export function App() {
  const isMobile = useIsMobile();
  useKeyboardShortcuts();
  useRedWatchBridge();

  const [currentTab, setCurrentTab] = useState<AppTab>('landing');
  const [searchQuery, setSearchQuery] = useState('');
  const { status, isLoading, checkAuth } = useAuthStore();
  const { modalOpen: eqOpen, setModalOpen: setEqOpen } = useEqualizerStore();
  const {
    nowPlayingOpen,
    setNowPlayingOpen,
    settingsOpen,
    setSettingsOpen,
    waveSettingsOpen,
    setWaveSettingsOpen,
  } = useWindowStore();

  useEffect(() => {
    checkAuth();
    const handler = () => setEqOpen(true);
    window.addEventListener('open-equalizer', handler);

    let unlistenClose: (() => void) | null = null;
    try {
      const win = getCurrentWindow();
      win
        .onCloseRequested(async (event) => {
          const { closeToTray } = useWindowStore.getState();
          if (closeToTray) {
            event.preventDefault();
            await win.hide();
          }
        })
        .then((unlisten) => {
          unlistenClose = unlisten;
        })
        .catch(() => {});
    } catch {}

    return () => {
      window.removeEventListener('open-equalizer', handler);
      if (unlistenClose) unlistenClose();
    };
  }, [checkAuth, setEqOpen]);

  // Android Hardware / Gesture Back Button Handling
  const handleAndroidBack = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Back' || (e as any).keyCode === 27) {
        if (nowPlayingOpen) {
          e.preventDefault();
          setNowPlayingOpen(false);
          return;
        }
        if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
          return;
        }
        if (waveSettingsOpen) {
          e.preventDefault();
          setWaveSettingsOpen(false);
          return;
        }
        if (eqOpen) {
          e.preventDefault();
          setEqOpen(false);
          return;
        }
        if (currentTab !== 'landing') {
          e.preventDefault();
          setCurrentTab('landing');
          return;
        }
      }
    },
    [nowPlayingOpen, settingsOpen, waveSettingsOpen, eqOpen, currentTab, setNowPlayingOpen, setSettingsOpen, setWaveSettingsOpen, setEqOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleAndroidBack);
    return () => window.removeEventListener('keydown', handleAndroidBack);
  }, [handleAndroidBack]);

  if (isLoading && !status) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          backgroundColor: '#10131C',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: '#888888',
        }}
      >
        <Loader2 size={32} className="animate-spin text-accent" />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>
          Загрузка Музыки...
        </span>
      </div>
    );
  }

  if (!status?.authenticated) {
    return <AuthModal />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#10131C',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Invisible Audio Engine & Background State Sync */}
      <AudioEngine />

      {/* HEADER: Desktop Frameless TitleBar (Mobile pages render their own Airy Top Bar) */}
      {!isMobile && (
        <TitleBar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* MAIN VIEWPORT */}
      <main
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#10131C',
        }}
      >
        {currentTab === 'landing' && <LandingPage onSelectTab={setCurrentTab} />}
        {currentTab === 'collection' && <CollectionPage onSelectTab={setCurrentTab} />}
        {currentTab === 'search' && (
          <SearchPage query={searchQuery} onQueryChange={setSearchQuery} />
        )}
      </main>

      {/* FOOTER: Mobile 2-Tier Thumb Dock vs Desktop PlayerBar */}
      {isMobile ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto px-gutter-md pb-[calc(14px+var(--sab,0px))] pt-gutter-sm bg-gradient-to-t from-dark-surface via-dark-surface/95 to-transparent pointer-events-none">
          <div className="flex flex-col gap-gutter-sm pointer-events-auto">
            <MobileMiniPlayer />
            <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />
          </div>
        </div>
      ) : (
        <>
          <PlayerBar />
          <RightDrawer />
        </>
      )}

      {/* IMMERSIVE NOW PLAYING OVERLAY (Fullscreen Player triggered by album cover or mini player) */}
      <ImmersiveNowPlaying />

      {/* GLOBAL MODALS */}
      <SettingsModal />
      <EqualizerModal />
      <WaveSettingsModal />
    </div>
  );
}

export default App;
