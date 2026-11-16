import { create } from 'zustand';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { ViewMode, SceneMode, AudioQuality } from '../types';
import { setAudioQuality as apiSetQuality, getAudioQuality as apiGetQuality } from '../api';

interface WindowState {
  viewMode: ViewMode;
  alwaysOnTop: boolean;
  isIdle: boolean;
  miniKaraoke: boolean;
  sceneMode: SceneMode;
  audioQuality: AudioQuality;
  waveSettingsOpen: boolean;
  studioPlayerOpen: boolean;
  nowPlayingOpen: boolean;
  sideDrawer: 'lyrics' | 'queue' | null;
  settingsOpen: boolean;
  closeToTray: boolean;
  redWatchEnabled: boolean;

  setViewMode: (mode: ViewMode) => Promise<void>;
  setAlwaysOnTop: (always: boolean) => Promise<void>;
  setIsIdle: (idle: boolean) => void;
  toggleMiniKaraoke: () => Promise<void>;
  setSceneMode: (mode: SceneMode) => void;
  setAudioQuality: (quality: AudioQuality) => Promise<void>;
  setWaveSettingsOpen: (open: boolean) => void;
  setStudioPlayerOpen: (open: boolean) => void;
  setNowPlayingOpen: (open: boolean) => void;
  setSideDrawer: (drawer: 'lyrics' | 'queue' | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setCloseToTray: (closeToTray: boolean) => void;
  setRedWatchEnabled: (enabled: boolean) => void;
  initWindow: () => Promise<void>;
}

export const useWindowStore = create<WindowState>((set, get) => ({
  viewMode: 'full',
  alwaysOnTop: false,
  isIdle: false,
  miniKaraoke: false,
  sceneMode: 'default',
  audioQuality: 'hq_320',
  waveSettingsOpen: false,
  studioPlayerOpen: false,
  nowPlayingOpen: false,
  sideDrawer: null,
  settingsOpen: false,
  setSideDrawer: (sideDrawer) => set({ sideDrawer }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setNowPlayingOpen: (nowPlayingOpen) => set({ nowPlayingOpen, studioPlayerOpen: nowPlayingOpen }),
  closeToTray: typeof window !== 'undefined' ? localStorage.getItem('ym_close_to_tray') !== 'false' : true,
  setCloseToTray: (closeToTray: boolean) => {
    try {
      localStorage.setItem('ym_close_to_tray', String(closeToTray));
    } catch {}
    set({ closeToTray });
  },
  redWatchEnabled: typeof window !== 'undefined' ? localStorage.getItem('ym_redwatch_enabled') === 'true' : false,
  setRedWatchEnabled: (redWatchEnabled: boolean) => {
    try {
      localStorage.setItem('ym_redwatch_enabled', String(redWatchEnabled));
    } catch {}
    set({ redWatchEnabled });
  },

  setViewMode: async (mode: ViewMode) => {
    set({ viewMode: mode, isIdle: false });

    try {
      const appWin = getCurrentWindow();
      if (mode === 'full') {
        await appWin.setAlwaysOnTop(false);
        await appWin.setResizable(true);
        await appWin.setSize(new LogicalSize(1200, 780));
        await appWin.center();
        set({ alwaysOnTop: false });
      } else if (mode === 'mini') {
        const height = get().miniKaraoke ? 300 : 150;
        await appWin.setAlwaysOnTop(true);
        await appWin.setResizable(false);
        await appWin.setSize(new LogicalSize(380, height));
        set({ alwaysOnTop: true });
      } else if (mode === 'docked') {
        await appWin.setAlwaysOnTop(true);
        await appWin.setResizable(false);
        await appWin.setSize(new LogicalSize(64, 64));
        set({ alwaysOnTop: true });
      }
    } catch (e) {
      console.warn('Tauri window API not available in browser mode:', e);
    }
  },

  setAlwaysOnTop: async (always: boolean) => {
    try {
      const appWin = getCurrentWindow();
      await appWin.setAlwaysOnTop(always);
      set({ alwaysOnTop: always });
    } catch (e) {
      console.warn('Failed to set always on top:', e);
    }
  },

  setIsIdle: (isIdle: boolean) => set({ isIdle }),

  toggleMiniKaraoke: async () => {
    const next = !get().miniKaraoke;
    set({ miniKaraoke: next });

    if (get().viewMode === 'mini') {
      try {
        const appWin = getCurrentWindow();
        await appWin.setSize(new LogicalSize(380, next ? 300 : 150));
      } catch (e) {
        console.warn('Failed to resize mini window for karaoke:', e);
      }
    }
  },

  setSceneMode: (mode: SceneMode) => {
    set({ sceneMode: mode });
  },

  setAudioQuality: async (quality: AudioQuality) => {
    set({ audioQuality: quality });
    try {
      await apiSetQuality(quality);
    } catch (e) {
      console.error('Failed to set audio quality:', e);
    }
  },

  setWaveSettingsOpen: (waveSettingsOpen: boolean) => set({ waveSettingsOpen }),
  setStudioPlayerOpen: (studioPlayerOpen: boolean) => set({ studioPlayerOpen, nowPlayingOpen: studioPlayerOpen }),

  initWindow: async () => {
    try {
      const q = await apiGetQuality();
      if (q && ['hq_320', 'medium_192', 'low_128', 'lossless'].includes(q)) {
        set({ audioQuality: q as AudioQuality });
      }
    } catch (e) {
      console.warn('Failed to initialize audio quality:', e);
    }
  },
}));
