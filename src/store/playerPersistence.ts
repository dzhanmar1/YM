import type { RepeatMode, TrackItem } from '../types';

export interface PersistedPlayerState {
  currentTrack: TrackItem | null;
  queue: TrackItem[];
  queueIndex: number;
  volume: number;
  isMuted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  history: TrackItem[];
}

const STORAGE_KEY = 'ym_player_session_state';

export function savePlayerState(state: Partial<PersistedPlayerState>) {
  try {
    const existing = loadPlayerState() || {
      currentTrack: null,
      queue: [],
      queueIndex: 0,
      volume: 0.85,
      isMuted: false,
      repeat: 'off' as RepeatMode,
      shuffle: false,
      history: [],
    };

    const merged = { ...existing, ...state };
    // Limit queue size in storage to max 100 tracks to avoid large localStorage payload
    if (merged.queue && merged.queue.length > 100) {
      merged.queue = merged.queue.slice(0, 100);
    }
    // Limit history size to max 50 tracks
    if (merged.history && merged.history.length > 50) {
      merged.history = merged.history.slice(0, 50);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('Failed to persist player state:', e);
  }
}

export function loadPlayerState(): PersistedPlayerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      currentTrack: parsed.currentTrack || null,
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      queueIndex: typeof parsed.queueIndex === 'number' ? parsed.queueIndex : 0,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.85,
      isMuted: Boolean(parsed.isMuted),
      repeat: parsed.repeat || 'off',
      shuffle: Boolean(parsed.shuffle),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch (e) {
    console.warn('Failed to load persisted player state:', e);
    return null;
  }
}
