import { create } from 'zustand';
import * as api from '../api';
import type { SyncedLyrics } from '../types';

interface LyricsState {
  lyrics: SyncedLyrics | null;
  isLoading: boolean;
  error: string | null;
  isKaraokeOpen: boolean;
  activeLineIndex: number;

  toggleKaraoke: () => void;
  setKaraokeOpen: (open: boolean) => void;
  loadLyrics: (trackId: string) => Promise<void>;
  updateActiveLine: (currentTimeMs: number) => void;
  clearLyrics: () => void;
}

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyrics: null,
  isLoading: false,
  error: null,
  isKaraokeOpen: false,
  activeLineIndex: -1,

  toggleKaraoke: () => set((s) => ({ isKaraokeOpen: !s.isKaraokeOpen })),
  setKaraokeOpen: (open: boolean) => set({ isKaraokeOpen: open }),

  loadLyrics: async (trackId: string) => {
    set({ isLoading: true, error: null, lyrics: null, activeLineIndex: -1 });
    try {
      const data = await api.getLyrics(trackId);
      set({ lyrics: data, isLoading: false });
    } catch (e: any) {
      set({ error: 'Текст песни не найден', isLoading: false });
    }
  },

  updateActiveLine: (currentTimeMs: number) => {
    const { lyrics, activeLineIndex } = get();
    if (!lyrics || !lyrics.is_synced || lyrics.lines.length === 0) {
      if (activeLineIndex !== -1) set({ activeLineIndex: -1 });
      return;
    }

    const lines = lyrics.lines;
    let newIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (currentTimeMs >= lines[i].time_ms) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== activeLineIndex) {
      set({ activeLineIndex: newIndex });
    }
  },

  clearLyrics: () => set({ lyrics: null, activeLineIndex: -1, error: null }),
}));
