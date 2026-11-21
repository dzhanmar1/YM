import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { usePlayerStore } from '../store/playerStore';
import { useWindowStore } from '../store/windowStore';

export function useRedWatchBridge() {
  const isSyncingRef = useRef(false);
  const redWatchEnabled = useWindowStore((s) => s.redWatchEnabled);

  useEffect(() => {
    // Only run RedWatch sync on Desktop Tauri; disabled on Web/PWA to avoid mixed-content and battery drain
    if (!isTauri() || !redWatchEnabled) return;

    let timerId: any = null;
    let isDisposed = false;
    let preferredHost = 'http://127.0.0.1:8765';
    let consecutiveFailures = 0;

    const syncWithAgent = async () => {
      if (isSyncingRef.current || isDisposed) return;
      isSyncingRef.current = true;

      let success = false;

      try {
        const store = usePlayerStore.getState();
        if (!store) {
          isSyncingRef.current = false;
          if (!isDisposed) timerId = setTimeout(syncWithAgent, 2000);
          return;
        }

        const currentTrack = store.currentTrack;
        let artistStr = '';
        if (currentTrack?.artists) {
          artistStr = Array.isArray(currentTrack.artists)
            ? currentTrack.artists.join(', ')
            : String(currentTrack.artists);
        }

        let isLiked = false;
        try {
          if (currentTrack?.id && store.likedIds) {
            isLiked = store.likedIds.has(String(currentTrack.id));
          } else if (currentTrack?.id && typeof (store as any).isLiked === 'function') {
            isLiked = Boolean((store as any).isLiked(currentTrack.id));
          }
        } catch (_) { }

        const payload = {
          hasTrack: Boolean(currentTrack),
          title: currentTrack?.title || (store.isPlaying ? 'Воспроизведение...' : 'Нет трека'),
          artist: artistStr || (store.isPlaying ? 'YM Desktop' : 'Ожидание'),
          album: currentTrack?.album_title || '',
          duration: store.duration || 0,
          currentTime: store.currentTime || 0,
          isPlaying: Boolean(store.isPlaying),
          volume: Math.round((store.volume ?? 0.8) * 100),
          isMuted: Boolean(store.isMuted),
          waveMode: Boolean(store.waveMode),
          waveModeId: store.waveModeId || '',
          waveSettings: store.waveSettings || null,
          isLiked,
        };

        (window as any).__REDWATCH_STATE__ = payload;

        let res: Response | null = null;
        try {
          res = await fetch(`${preferredHost}/ym/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(1500),
          });
        } catch (_) {
          // Switch host for next try
          preferredHost = preferredHost.includes('127.0.0.1') ? 'http://localhost:8765' : 'http://127.0.0.1:8765';
        }

        if (res && res.ok) {
          success = true;
          consecutiveFailures = 0;
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.commands)) {
            for (const cmd of data.commands) {
              await handleCommand(cmd);
            }
          }
        } else {
          consecutiveFailures++;
        }
      } catch (_) {
        consecutiveFailures++;
      } finally {
        isSyncingRef.current = false;
      }

      if (!isDisposed) {
        // Smart backoff: if service offline, pause 4.5s instead of spamming every 800ms
        const delay = success ? 800 : Math.min(5000, 1500 + consecutiveFailures * 1000);
        timerId = setTimeout(syncWithAgent, delay);
      }
    };

    const handleCommand = async (cmd: { action: string;[key: string]: any }) => {
      try {
        const s = usePlayerStore.getState();
        if (!s) return;

        switch (cmd.action) {
          case 'playpause':
          case 'toggle':
            if (typeof s.togglePlay === 'function') await s.togglePlay();
            break;
          case 'next':
            if (typeof s.playNext === 'function') await s.playNext();
            break;
          case 'prev':
            if (typeof s.playPrev === 'function') s.playPrev();
            break;
          case 'volume':
            if (cmd.val !== undefined && typeof s.setVolume === 'function') {
              s.setVolume(Math.max(0, Math.min(1, cmd.val / 100)));
            }
            break;
          case 'like':
            if (s.currentTrack && typeof s.toggleLike === 'function') {
              await s.toggleLike(s.currentTrack);
            }
            break;
          case 'dislike':
            if (typeof s.dislikeWaveTrack === 'function') await s.dislikeWaveTrack();
            break;
          case 'skip_wave':
            if (typeof s.skipWave === 'function') await s.skipWave();
            break;
          case 'start_wave':
          case 'wave':
            if (typeof s.startWave === 'function') await s.startWave();
            break;
          case 'wave_mood':
            if (cmd.mood && typeof s.startCustomWave === 'function') {
              await s.startCustomWave({ mood: cmd.mood });
            }
            break;
          case 'wave_character':
            if (cmd.character && typeof s.startCustomWave === 'function') {
              await s.startCustomWave({ character: cmd.character });
            }
            break;
          case 'wave_custom':
            if (typeof s.startCustomWave === 'function') {
              await s.startCustomWave(cmd.options || {});
            }
            break;
        }
      } catch (e) {
        console.error('[RedWatch Bridge] Command error:', e);
      }
    };

    syncWithAgent();

    return () => {
      isDisposed = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [redWatchEnabled]);
}
