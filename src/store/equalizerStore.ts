import { create } from 'zustand';
import { EqualizerPreset, EqualizerSettings } from '../types';
import { saveEqualizer, loadEqualizer } from '../api';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<EqualizerPreset, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass_boost: [6, 5.5, 4.5, 3, 1, 0, 0, 0, 0, 0],
  vocal_boost: [-2, -2, -1, 1, 3.5, 4, 3, 1.5, 0, -1],
  rock: [4.5, 3.5, 2, -1, -2, 0, 2.5, 4, 4.5, 5],
  electronic: [5.5, 5, 2, 0, -1, 1.5, 2, 3.5, 4.5, 4],
  acoustic: [3, 2.5, 1.5, 1, 2, 2.5, 3, 2.5, 2, 1.5],
  chill: [2, 1.5, 1, 0, 0, -1, -1, -1.5, -2, -3],
  custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

interface EqualizerState {
  enabled: boolean;
  preAmp: number;
  bands: number[];
  preset: EqualizerPreset;
  modalOpen: boolean;

  setBand: (index: number, value: number) => void;
  setPreAmp: (value: number) => void;
  setPreset: (preset: EqualizerPreset) => void;
  setEnabled: (enabled: boolean) => void;
  setModalOpen: (open: boolean) => void;
  reset: () => void;
  loadSettings: () => Promise<void>;
}

export const useEqualizerStore = create<EqualizerState>((set, get) => ({
  enabled: true,
  preAmp: 0,
  bands: [...EQ_PRESETS.flat],
  preset: 'flat',
  modalOpen: false,

  setBand: (index, value) => {
    const newBands = [...get().bands];
    newBands[index] = Math.max(-12, Math.min(12, Math.round(value * 10) / 10));
    set({ bands: newBands, preset: 'custom' });
    saveCurrent(get());
  },

  setPreAmp: (value) => {
    const val = Math.max(-12, Math.min(12, Math.round(value * 10) / 10));
    set({ preAmp: val });
    saveCurrent(get());
  },

  setPreset: (preset) => {
    if (preset === 'custom') {
      set({ preset: 'custom' });
      return;
    }
    const targetBands = [...EQ_PRESETS[preset]];
    set({ preset, bands: targetBands });
    saveCurrent(get());
  },

  setEnabled: (enabled) => {
    set({ enabled });
    saveCurrent(get());
  },

  setModalOpen: (modalOpen) => set({ modalOpen }),

  reset: () => {
    set({
      enabled: true,
      preAmp: 0,
      bands: [...EQ_PRESETS.flat],
      preset: 'flat',
    });
    saveCurrent(get());
  },

  loadSettings: async () => {
    try {
      const raw = await loadEqualizer();
      if (raw) {
        const parsed: EqualizerSettings = JSON.parse(raw);
        if (Array.isArray(parsed.bands) && parsed.bands.length === 10) {
          set({
            enabled: parsed.enabled ?? true,
            preAmp: parsed.preAmp ?? 0,
            bands: parsed.bands,
            preset: parsed.preset ?? 'flat',
          });
        }
      }
    } catch (e) {
      console.error('Failed to load equalizer settings:', e);
    }
  },
}));

function saveCurrent(state: EqualizerState) {
  const settings: EqualizerSettings = {
    enabled: state.enabled,
    preAmp: state.preAmp,
    bands: state.bands,
    preset: state.preset,
  };
  saveEqualizer(JSON.stringify(settings)).catch((err) =>
    console.error('Failed to save equalizer settings:', err)
  );
}
