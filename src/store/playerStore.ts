import { create } from 'zustand';
import * as api from '../api';
import type { RepeatMode, TrackItem } from '../types';
import { useLyricsStore } from './lyricsStore';
import { savePlayerState, loadPlayerState } from './playerPersistence';

interface PlayerState {
  currentTrack: TrackItem | null;
  streamUrl: string | null;
  queue: TrackItem[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  currentTime: number;
  bufferedTime: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;

  // Rotor («Моя волна»)
  waveMode: boolean;
  waveStationId: string;
  waveModeId: string;
  waveBatchId: string;

  // Liked tracks set for instant O(1) state lookup
  likedIds: Set<string>;

  // Playback history
  history: TrackItem[];
  clearHistory: () => void;

  // Actions
  playTrack: (track: TrackItem, queue?: TrackItem[], index?: number, isWavePlay?: boolean) => Promise<void>;
  setQueue: (queue: TrackItem[], index?: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => Promise<void>;
  playPrev: () => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBufferedTime: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  seek: (time: number) => void;

  // Rotor Actions
  startWave: () => Promise<void>;
  waveSettings: { activity?: string; mood?: string; character?: string; language?: string } | null;
  startCustomWave: (options: { activity?: string; mood?: string; character?: string; language?: string }) => Promise<void>;
  startEntityWave: (entityType: 'track' | 'artist' | 'genre', entityId: string) => Promise<void>;
  skipWave: () => Promise<void>;
  setWaveStation: (stationId: string, batchId: string, modeId?: string) => void;

  setIsLoading: (loading: boolean) => void;
  dislikeWaveTrack: () => Promise<void>;

  // Likes
  setLikedIds: (ids: string[]) => void;
  toggleLike: (track: TrackItem) => Promise<void>;
  isLiked: (trackId: string) => boolean;
}

const initialSession = loadPlayerState();

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: initialSession?.currentTrack ?? null,
  streamUrl: null,
  queue: initialSession?.queue ?? [],
  queueIndex: initialSession?.queueIndex ?? 0,
  isPlaying: false,
  isLoading: false,
  duration: initialSession?.currentTrack?.duration_ms ? initialSession.currentTrack.duration_ms / 1000 : 0,
  currentTime: 0,
  bufferedTime: 0,
  volume: initialSession?.volume ?? 0.85,
  isMuted: initialSession?.isMuted ?? false,
  shuffle: initialSession?.shuffle ?? false,
  repeat: initialSession?.repeat ?? 'off',

  waveMode: false,
  waveStationId: '',
  waveModeId: '',
  waveSettings: null,
  waveBatchId: '',
  likedIds: new Set(),
  history: initialSession?.history ?? [],
  clearHistory: () => {
    set({ history: [] });
    savePlayerState({ history: [] });
  },

  setWaveStation: (stationId: string, batchId: string, modeId?: string) => {
    set({ waveStationId: stationId, waveBatchId: batchId, waveModeId: modeId || 'default', waveMode: true });
  },

  playTrack: async (track: TrackItem, newQueue?: TrackItem[], index = 0, isWavePlay = false) => {
    const streamUrl = await api.getStreamUrl(track.id);

    // Track in history
    const currentHistory = get().history;
    const updatedHistory = [track, ...currentHistory.filter((t) => t.id !== track.id)].slice(0, 50);

    if (newQueue) {
      set({
        currentTrack: track,
        streamUrl,
        queue: newQueue,
        queueIndex: index,
        history: updatedHistory,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
        // Only reset waveMode if this is an explicit user playlist play, not an internal wave track change
        ...(isWavePlay ? {} : { waveMode: false, waveSettings: null }),
      });
      savePlayerState({
        currentTrack: track,
        queue: newQueue,
        queueIndex: index,
        history: updatedHistory,
      });
    } else {
      set({
        currentTrack: track,
        streamUrl,
        history: updatedHistory,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
      });
      savePlayerState({
        currentTrack: track,
        history: updatedHistory,
      });
    }

    // Automatically load synchronized lyrics for the track
    useLyricsStore
      .getState()
      .loadLyrics(track.id, track.title, track.artists?.[0], Math.round(track.duration_ms / 1000));

    // If in Wave mode, report trackStarted to advance Yandex Rotor recommendation state
    const { waveMode: isWave, waveStationId: wStationId, waveBatchId: wBatchId } = get();
    if (isWave && wStationId && wBatchId) {
      api.sendRotorFeedback(
        wStationId,
        wBatchId,
        track.id,
        track.album_id,
        'trackStarted'
      ).catch(() => {});
    }

    // Proactive background queue top-up for Wave mode:
    // When 3 or fewer tracks remain ahead, pre-fetch next batch while music is actively playing.
    // This prevents silence between tracks on mobile iOS which causes iOS to suspend background playback!
    const effectiveWave = isWave || isWavePlay;
    const activeQueue = newQueue || get().queue;
    const activeIdx = index !== undefined ? index : get().queueIndex;
    if (effectiveWave && activeQueue.length - activeIdx <= 3 && wStationId) {
      api.getStationTracks(wStationId, track.id).then((nextStation) => {
        if (nextStation.tracks && nextStation.tracks.length > 0) {
          const currentQueue = get().queue;
          const existingIds = new Set(currentQueue.map((t) => t.id));
          const fresh = nextStation.tracks.filter((t) => !existingIds.has(t.id));
          if (fresh.length > 0) {
            const updatedQueue = [...currentQueue, ...fresh];
            set({
              queue: updatedQueue,
              waveBatchId: nextStation.batch_id,
            });
            savePlayerState({
              queue: updatedQueue,
              queueIndex: get().queueIndex,
              currentTrack: get().currentTrack,
            });
          }
        }
      }).catch(() => {});
    }
  },

  setQueue: (queue: TrackItem[], index = 0) => {
    // setQueue is always a manual user action, reset wave mode
    set({ queue, queueIndex: index, waveMode: false, waveSettings: null });
    if (queue.length > 0 && queue[index]) {
      get().playTrack(queue[index], queue, index, false);
    }
  },

  moveQueueItem: (fromIndex: number, toIndex: number) => {
    const { queue, queueIndex } = get();
    if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;
    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);

    let newQueueIndex = queueIndex;
    if (queueIndex === fromIndex) {
      newQueueIndex = toIndex;
    } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
      newQueueIndex--;
    } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
      newQueueIndex++;
    }

    set({ queue: newQueue, queueIndex: newQueueIndex });
    savePlayerState({ queue: newQueue, queueIndex: newQueueIndex });
  },

  removeFromQueue: (index: number) => {
    const { queue, queueIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const newQueue = queue.filter((_, i) => i !== index);
    let newQueueIndex = queueIndex;
    if (index < queueIndex) {
      newQueueIndex--;
    } else if (index === queueIndex && newQueueIndex >= newQueue.length) {
      newQueueIndex = Math.max(0, newQueue.length - 1);
    }
    set({ queue: newQueue, queueIndex: newQueueIndex });
    savePlayerState({ queue: newQueue, queueIndex: newQueueIndex });
  },

  playNext: async () => {
    const {
      queue,
      queueIndex,
      repeat,
      shuffle,
      waveMode,
      waveStationId,
      waveBatchId,
      currentTrack,
      currentTime,
    } = get();

    // In Wave mode, report trackFinished or skip feedback
    if (waveMode && currentTrack) {
      api.sendRotorFeedback(
        waveStationId,
        waveBatchId,
        currentTrack.id,
        currentTrack.album_id,
        currentTime > 25 ? 'trackFinished' : 'skip',
        currentTime
      ).catch(() => {});
    }

    if (waveMode) {
      const nextIdx = queueIndex + 1;
      if (nextIdx < queue.length) {
        set({ queueIndex: nextIdx });
        // isWavePlay=true preserves waveMode state
        await get().playTrack(queue[nextIdx], undefined, undefined, true);
      } else {
        // Fetch next batch of tracks from Wave station
        set({ isLoading: true });
        try {
          const nextStation = await api.getStationTracks(
            waveStationId,
            currentTrack?.id
          );
          if (nextStation.tracks.length > 0) {
            // Deduplicate against tracks already in the session queue
            const existingIds = new Set(queue.map((t) => t.id));
            const freshTracks = nextStation.tracks.filter((t) => !existingIds.has(t.id));
            const tracksToAdd = freshTracks.length > 0 ? freshTracks : nextStation.tracks;
            const combinedQueue = [...queue, ...tracksToAdd];
            set({
              queue: combinedQueue,
              queueIndex: nextIdx,
              waveBatchId: nextStation.batch_id,
            });
            // isWavePlay=true preserves waveMode state
            await get().playTrack(combinedQueue[nextIdx], undefined, undefined, true);
          } else {
            set({ isLoading: false });
          }
        } catch (e) {
          console.error('Failed to load next wave tracks:', e);
          set({ isLoading: false });
        }
      }
      return;
    }

    // Standard queue playback
    if (queue.length === 0) return;

    if (repeat === 'one') {
      await get().playTrack(queue[queueIndex]);
      return;
    }

    let nextIndex: number;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }

    set({ queueIndex: nextIndex });
    await get().playTrack(queue[nextIndex]);
  },

  playPrev: () => {
    const { queue, queueIndex, currentTime } = get();

    // If played more than 3 seconds, restart current track
    if (currentTime > 3) {
      get().seek(0);
      return;
    }

    if (queue.length === 0) return;

    const prevIndex = Math.max(0, queueIndex - 1);
    set({ queueIndex: prevIndex });
    get().playTrack(queue[prevIndex]);
  },

  togglePlay: async () => {
    const { isPlaying, currentTrack, streamUrl } = get();
    if (!isPlaying && currentTrack && !streamUrl) {
      await get().playTrack(currentTrack);
    } else {
      set({ isPlaying: !isPlaying });
    }
  },
  setIsLoading: (isLoading: boolean) => set({ isLoading }),
  setPlaying: (playing: boolean) => set({ isPlaying: playing }),
  dislikeWaveTrack: async () => {
    const { currentTrack, waveMode, waveStationId, waveBatchId, currentTime, playNext } = get();
    if (!currentTrack) return;
    if (waveMode && waveStationId && waveBatchId) {
      api.sendRotorFeedback(
        waveStationId,
        waveBatchId,
        currentTrack.id,
        currentTrack.album_id,
        'dislike',
        currentTime
      ).catch(() => {});
    }
    await playNext();
  },
  setCurrentTime: (currentTime: number) => {
    set({ currentTime });
    useLyricsStore.getState().updateActiveLine(currentTime * 1000);
  },
  setDuration: (duration: number) => set({ duration }),
  setBufferedTime: (bufferedTime: number) => set({ bufferedTime }),

  setVolume: (volume: number) => {
    const v = Math.max(0, Math.min(1, volume));
    savePlayerState({ volume: v, isMuted: false });
    set({ volume: v, isMuted: false });
  },
  toggleMute: () =>
    set((s) => {
      const nextMuted = !s.isMuted;
      savePlayerState({ isMuted: nextMuted });
      return { isMuted: nextMuted };
    }),
  toggleShuffle: () =>
    set((s) => {
      const nextShuffle = !s.shuffle;
      savePlayerState({ shuffle: nextShuffle });
      return { shuffle: nextShuffle };
    }),

  toggleRepeat: () =>
    set((s) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const nextIdx = (modes.indexOf(s.repeat) + 1) % modes.length;
      const nextRepeat = modes[nextIdx];
      savePlayerState({ repeat: nextRepeat });
      return { repeat: nextRepeat };
    }),

  seek: (time: number) => {
    const validTime = Math.max(0, isFinite(time) ? time : 0);
    set({ currentTime: validTime });
    useLyricsStore.getState().updateActiveLine(validTime * 1000);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('player-seek', { detail: validTime }));
    }
  },

  startWave: async () => {
    set({ waveMode: true, isLoading: true });
    try {
      const station = await api.startMyWave();
      if (station.tracks.length > 0) {
        set({
          waveMode: true,
          waveStationId: station.station_id,
          waveModeId: 'user:onyourwave',
          waveSettings: null,
          waveBatchId: station.batch_id,
          queue: station.tracks,
          queueIndex: 0,
        });
        // Pass isWavePlay=true so waveMode is NOT reset
        await get().playTrack(station.tracks[0], station.tracks, 0, true);
        // Send radioStarted feedback
        api.sendRotorFeedback(
          station.station_id,
          station.batch_id,
          station.tracks[0].id,
          station.tracks[0].album_id,
          'radioStarted'
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to start wave:', e);
      set({ waveMode: false, isLoading: false });
    }
  },

  startCustomWave: async (options) => {
    let waveId = 'custom';
    if (options.activity) waveId = `activity:${options.activity}`;
    else if (options.language) waveId = `language:${options.language}`;
    else {
      const parts: string[] = [];
      if (options.mood) parts.push(`mood:${options.mood}`);
      if (options.character) parts.push(`character:${options.character}`);
      if (parts.length > 0) waveId = parts.join('+');
    }
    
    set({ waveMode: true, waveModeId: waveId, waveSettings: options, isLoading: true });
    try {
      const station = await api.startCustomWave(options);
      if (station.tracks.length > 0) {
        set({
          waveMode: true,
          waveStationId: station.station_id,
          waveModeId: waveId,
          waveSettings: options,
          waveBatchId: station.batch_id,
          queue: station.tracks,
          queueIndex: 0,
        });
        // Pass isWavePlay=true so waveMode is NOT reset
        await get().playTrack(station.tracks[0], station.tracks, 0, true);
        api.sendRotorFeedback(
          station.station_id,
          station.batch_id,
          station.tracks[0].id,
          station.tracks[0].album_id,
          'radioStarted'
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to start custom wave:', e);
      set({ waveMode: false, isLoading: false });
    }
  },

  startEntityWave: async (entityType: 'track' | 'artist' | 'genre', entityId: string) => {
    const stationId = `${entityType}:${entityId}`;
    set({ waveMode: true, waveModeId: stationId, waveSettings: null, isLoading: true });
    try {
      const station = await api.startEntityWave(entityType, entityId);
      if (station.tracks.length > 0) {
        set({
          waveMode: true,
          waveStationId: station.station_id,
          waveModeId: stationId,
          waveSettings: null,
          waveBatchId: station.batch_id,
          queue: station.tracks,
          queueIndex: 0,
        });
        await get().playTrack(station.tracks[0], station.tracks, 0, true);
        api.sendRotorFeedback(
          station.station_id,
          station.batch_id,
          station.tracks[0].id,
          station.tracks[0].album_id,
          'radioStarted'
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to start entity wave:', e);
      set({ waveMode: false, isLoading: false });
    }
  },

  skipWave: async () => {
    const { waveStationId, waveBatchId, currentTrack, currentTime } = get();
    if (currentTrack) {
      api.sendRotorFeedback(
        waveStationId,
        waveBatchId,
        currentTrack.id,
        currentTrack.album_id,
        'skip',
        currentTime
      ).catch(() => {});
    }
    await get().playNext();
  },

  setLikedIds: (ids: string[]) => set({ likedIds: new Set(ids) }),

  toggleLike: async (track: TrackItem) => {
    const { likedIds, waveMode, waveStationId, waveBatchId, currentTime } = get();
    const isCurrentlyLiked = likedIds.has(track.id);

    // Optimistic UI update
    const updated = new Set(likedIds);
    if (isCurrentlyLiked) {
      updated.delete(track.id);
    } else {
      updated.add(track.id);
    }
    set({ likedIds: updated });

    try {
      if (isCurrentlyLiked) {
        await api.unlikeTrack(track.id);
      } else {
        await api.likeTrack(track.id);
        if (waveMode) {
          api.sendRotorFeedback(
            waveStationId,
            waveBatchId,
            track.id,
            track.album_id,
            'like',
            currentTime
          ).catch(() => {});
        }
      }
    } catch (e) {
      // Revert on error
      set({ likedIds });
      console.error('Failed to toggle like:', e);
    }
  },

  isLiked: (trackId: string) => get().likedIds.has(trackId),
}));
