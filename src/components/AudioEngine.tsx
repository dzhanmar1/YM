import { useEffect, useRef, useCallback } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { usePlayerStore } from '../store/playerStore';
import { useLyricsStore } from '../store/lyricsStore';
import { useEqualizerStore, EQ_FREQUENCIES } from '../store/equalizerStore';
import { useWindowStore } from '../store/windowStore';
import { formatCoverUrl } from '../types';

import { audioVisualizer } from '../utils/audioVisualizer';

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fadeGainRef = useRef<GainNode | null>(null);
  const preAmpRef = useRef<GainNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isGraphInitialized = useRef(false);
  const isNearEndFadeRef = useRef(false);

  const fadeIn = useCallback((duration = 0.25) => {
    const ctx = audioCtxRef.current;
    const node = fadeGainRef.current;
    if (!ctx || !node) return;
    try {
      const t = ctx.currentTime;
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(0.001, t);
      node.gain.linearRampToValueAtTime(1.0, t + duration);
    } catch {}
  }, []);

  const fadeOut = useCallback((duration = 0.2) => {
    const ctx = audioCtxRef.current;
    const node = fadeGainRef.current;
    if (!ctx || !node) return;
    try {
      const t = ctx.currentTime;
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(Math.max(node.gain.value, 0.001), t);
      node.gain.linearRampToValueAtTime(0.001, t + duration);
    } catch {}
  }, []);

  const {
    streamUrl,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    queue,
    queueIndex,
    setCurrentTime,
    setDuration,
    setBufferedTime,
    setPlaying,
    setIsLoading,
    playNext,
    playPrev,
    togglePlay,
    toggleLike,
    toggleMute,
    setVolume,
    startWave,
    seek,
    currentTrack,
    likedIds,
    waveMode,
    waveStationId,
    waveModeId,
  } = usePlayerStore();

  const { lyrics, activeLineIndex } = useLyricsStore();

  const { enabled: eqEnabled, preAmp, bands, loadSettings } = useEqualizerStore();
  const { sceneMode } = useWindowStore();

  // Load saved equalizer settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 1. Initialize audio element and Web Audio API graph
  useEffect(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
    }
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');

    // On mobile devices (Android / iOS), routing HTMLAudioElement into AudioContext
    // via createMediaElementSource causes Chrome/Android OS to suspend playback
    // the moment the screen turns off. Native <audio> outputs directly to the system
    // hardware audio stack and plays smoothly with screen locked.
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768);

    const initAudioGraph = () => {
      if (isMobileDevice) return;
      if (isGraphInitialized.current) return;
      try {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(audio);

        // Smooth crossfade gain node
        const fadeGainNode = ctx.createGain();
        fadeGainNode.gain.setValueAtTime(1.0, ctx.currentTime);
        fadeGainRef.current = fadeGainNode;

        // Pre-Amp gain node
        const preAmpNode = ctx.createGain();
        preAmpRef.current = preAmpNode;

        // 10-band equalizer filters
        const filters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, idx) => {
          const filter = ctx.createBiquadFilter();
          filter.frequency.value = freq;
          if (idx === 0) {
            filter.type = 'lowshelf';
          } else if (idx === EQ_FREQUENCIES.length - 1) {
            filter.type = 'highshelf';
          } else {
            filter.type = 'peaking';
            filter.Q.value = 1.4;
          }
          filter.gain.value = 0;
          return filter;
        });
        filtersRef.current = filters;

        // Analyser node for real-time visualizers
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        audioVisualizer.init(analyser);

        // Connect chain: source -> fadeGainNode -> preAmp -> filter[0] -> ... -> filter[9] -> analyser -> destination
        source.connect(fadeGainNode);
        fadeGainNode.connect(preAmpNode);
        let lastNode: AudioNode = preAmpNode;
        for (const f of filters) {
          lastNode.connect(f);
          lastNode = f;
        }
        lastNode.connect(analyser);
        analyser.connect(ctx.destination);

        isGraphInitialized.current = true;
      } catch (err) {
        console.warn('Web Audio API audio graph initialization failed:', err);
      }
    };

    // Initialize Web Audio graph on first user interaction or playback
    const handleUserInteraction = () => {
      initAudioGraph();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };

    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      audio.pause();
      audio.src = '';
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // 2. Synchronize Equalizer Filter Gains and Pre-Amp
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !isGraphInitialized.current) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const preAmpNode = preAmpRef.current;
    if (preAmpNode) {
      const gainVal = eqEnabled ? Math.pow(10, preAmp / 20) : 1.0;
      preAmpNode.gain.setTargetAtTime(gainVal, ctx.currentTime, 0.05);
    }

    const filters = filtersRef.current;
    filters.forEach((filter, idx) => {
      const gain = eqEnabled && bands[idx] !== undefined ? bands[idx] : 0;
      filter.gain.setTargetAtTime(gain, ctx.currentTime, 0.05);
    });
  }, [eqEnabled, preAmp, bands]);

  // 3. Scene Modes Handling (Concentration / Workout / Relax)
  useEffect(() => {
    if (sceneMode === 'concentration') {
      // Smooth fade to low volume (0.25)
      setVolume(0.25);
    } else if (sceneMode === 'workout') {
      setVolume(0.85);
    } else if (sceneMode === 'relax') {
      setVolume(0.45);
    }
  }, [sceneMode, setVolume]);

  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isSwitchingTrackRef = useRef(false);

  // 4. Stream URL changed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (streamUrl) {
      isSwitchingTrackRef.current = true;
      isNearEndFadeRef.current = false;

      // Smooth fade out old audio before swapping stream source
      if (usePlayerStore.getState().isPlaying && audio.currentTime > 0) {
        fadeOut(0.12);
      }

      // Assign source immediately so audio element is always in a valid state
      audio.src = streamUrl;
      audio.load();

      if (usePlayerStore.getState().isPlaying) {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        const p = audio.play();
        playPromiseRef.current = p;
        p.then(() => {
          fadeIn(0.2);
        }).catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('Autoplay prevented or interrupted:', err);
          }
        }).finally(() => {
          if (playPromiseRef.current === p) {
            playPromiseRef.current = null;
          }
        });
      }

      const finishTimer = setTimeout(() => {
        isSwitchingTrackRef.current = false;
      }, 300);

      return () => {
        clearTimeout(finishTimer);
      };
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [streamUrl, fadeOut, fadeIn]);

  // 5. Play / Pause state synchronization
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src || isSwitchingTrackRef.current) return;

    if (isPlaying) {
      const startPlayback = async () => {
        try {
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
          }
        } catch (e) {
          console.warn('Could not resume audioContext:', e);
        }

        if (audio.paused) {
          try {
            const p = audio.play();
            playPromiseRef.current = p;
            await p;
            fadeIn(0.15);
          } catch (err: any) {
            if (err.name !== 'AbortError') {
              console.warn('Playback play failed:', err);
              setPlaying(false);
            }
          } finally {
            playPromiseRef.current = null;
          }
        }
      };

      startPlayback();
    } else {
      if (!audio.paused) {
        fadeOut(0.05);
        if (playPromiseRef.current) {
          playPromiseRef.current.then(() => {
            audio.pause();
          }).catch(() => {});
        } else {
          audio.pause();
        }
      }
    }
  }, [isPlaying, setPlaying, fadeIn, fadeOut]);

  // 6. Volume & Mute synchronization
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const lastTimeEmitRef = useRef(0);

  // 7. Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.buffered.length > 0) {
        setBufferedTime(audio.buffered.end(audio.buffered.length - 1));
      }

      // Smooth crossfade near track end (last 1.2s)
      if (audio.duration && audio.duration > 6 && audio.duration - audio.currentTime <= 1.2) {
        if (!isNearEndFadeRef.current) {
          isNearEndFadeRef.current = true;
          fadeOut(1.1);
        }
      } else if (audio.duration && audio.duration - audio.currentTime > 2.0) {
        isNearEndFadeRef.current = false;
      }

      // Throttled lightweight time update to mini window (approx. 4 times/sec, ~30 bytes)
      const now = performance.now();
      if (now - lastTimeEmitRef.current >= 250) {
        lastTimeEmitRef.current = now;
        invoke('cmd_emit_player_time', {
          currentTime: audio.currentTime,
          activeLineIndex: useLyricsStore.getState().activeLineIndex,
        }).catch(() => {});
      }
    };

    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      if (isSwitchingTrackRef.current) return;
      if (!audio || audio.currentTime < 2) return;
      playNext();
    };
    const handleError = (e: Event) => {
      console.warn('Audio playback error on track:', e);
      if (!isSwitchingTrackRef.current) {
        const now = performance.now();
        if (now - lastSkipActionRef.current > 800) {
          lastSkipActionRef.current = now;
          console.info('Auto-skipping unavailable track to next in queue...');
          playNext();
        } else {
          setPlaying(false);
        }
      }
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => {
      if (!isSwitchingTrackRef.current) {
        setPlaying(true);
      }
    };
    const handlePlaying = () => {
      setIsLoading(false);
      if (!isSwitchingTrackRef.current) {
        setPlaying(true);
      }
      fadeIn(0.25);
    };
    const handlePause = () => {
      if (!isSwitchingTrackRef.current && !audio.seeking && audio.currentTime < (audio.duration || 1)) {
        setPlaying(false);
      }
    };
    const handleSeeking = () => setIsLoading(true);
    const handleSeeked = () => setIsLoading(false);
    const handleLoadStart = () => setIsLoading(true);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [playNext, setCurrentTime, setDuration, setBufferedTime, setPlaying, setIsLoading]);

  // 8. External Seek synchronization
  useEffect(() => {
    const handleSeek = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      const targetTime = customEvent.detail;
      const audio = audioRef.current;
      if (!audio || typeof targetTime !== 'number' || !isFinite(targetTime) || targetTime < 0) return;

      if (audio.readyState === 0) {
        const onLoaded = () => {
          try {
            audio.currentTime = targetTime;
          } catch {}
        };
        audio.addEventListener('loadedmetadata', onLoaded, { once: true });
        return;
      }

      try {
        audio.currentTime = targetTime;
        if (usePlayerStore.getState().isPlaying) {
          fadeIn(0.1);
        }
      } catch (err) {
        console.warn('Failed to set audio.currentTime:', err);
      }
    };

    window.addEventListener('player-seek', handleSeek as EventListener);
    return () => {
      window.removeEventListener('player-seek', handleSeek as EventListener);
    };
  }, [fadeIn]);

  // 9a. Media Session Metadata — ONLY updates when track changes (eliminates cover flickering/blinking!)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const coverUri = currentTrack.cover_uri;
    const artwork = coverUri
      ? [
          { src: formatCoverUrl(coverUri, '96x96'), sizes: '96x96', type: 'image/jpeg' },
          { src: formatCoverUrl(coverUri, '128x128'), sizes: '128x128', type: 'image/jpeg' },
          { src: formatCoverUrl(coverUri, '192x192'), sizes: '192x192', type: 'image/jpeg' },
          { src: formatCoverUrl(coverUri, '256x256'), sizes: '256x256', type: 'image/jpeg' },
          { src: formatCoverUrl(coverUri, '384x384'), sizes: '384x384', type: 'image/jpeg' },
          { src: formatCoverUrl(coverUri, '512x512'), sizes: '512x512', type: 'image/jpeg' },
        ]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || 'YM',
      artist: currentTrack.artists?.join(', ') || 'Yandex Music',
      album: currentTrack.album_title || '',
      artwork,
    });

    if (isTauri()) {
      const tooltipText = `${currentTrack.title} — ${currentTrack.artists.join(', ')}`;
      invoke('cmd_update_tray_tooltip', { tooltip: tooltipText }).catch(() => {});
    }
  }, [currentTrack?.id]);

  // 9b. Media Session Action Handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => setPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setPlaying(false));
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seek(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const cur = audioRef.current?.currentTime || 0;
        const dur = audioRef.current?.duration || 0;
        seek(Math.min(dur, cur + (details.seekOffset || 10)));
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const cur = audioRef.current?.currentTime || 0;
        seek(Math.max(0, cur - (details.seekOffset || 10)));
      });
    } catch {}
  }, [playNext, playPrev, setPlaying, seek]);

  // 9c. Sync MediaSession playbackState with player state (vital for Android OS background audio service)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // 9d. Sync MediaSession position state for lockscreen scrubber (throttled to avoid notification re-renders)
  const lastPositionSyncRef = useRef<number>(0);
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    const now = performance.now();
    // Only update position every 2.5 seconds or on play/pause, since Android OS smoothly advances the lockscreen scrubber automatically based on playbackRate: 1.0!
    if (now - lastPositionSyncRef.current < 2500 && isPlaying) return;
    lastPositionSyncRef.current = now;

    if (duration > 0 && isFinite(duration) && isFinite(currentTime)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(duration, 0),
          playbackRate: isPlaying ? 1.0 : 0.0,
          position: Math.min(Math.max(currentTime, 0), duration),
        });
      } catch {}
    }
  }, [currentTime, duration, isPlaying]);

  // Ref for throttling rapid next/prev triggers
  const lastSkipActionRef = useRef<number>(0);

  // 10. Sync player state to mini window whenever metadata, controls, or wave mode change (Tauri desktop only)
  const emitFullState = useCallback(() => {
    if (!isTauri()) return;
    const isLiked = currentTrack ? likedIds.has(currentTrack.id) : false;
    const curTime = audioRef.current ? audioRef.current.currentTime : 0;
    const stateJson = JSON.stringify({
      currentTrack,
      isPlaying,
      currentTime: curTime,
      duration,
      volume,
      isMuted,
      isLiked,
      queue,
      queueIndex,
      lyrics,
      activeLineIndex: useLyricsStore.getState().activeLineIndex,
      eqPreset: useEqualizerStore.getState().preset,
      waveMode,
      waveStationId,
      waveModeId,
    });
    invoke('cmd_emit_player_state', { stateJson }).catch(() => {});
  }, [currentTrack, isPlaying, duration, volume, isMuted, likedIds, queue, queueIndex, lyrics, waveMode, waveStationId, waveModeId]);

  useEffect(() => {
    emitFullState();
  }, [emitFullState]);

  const emitFullStateRef = useRef(emitFullState);
  useEffect(() => {
    emitFullStateRef.current = emitFullState;
  }, [emitFullState]);

  // 10b. Stream lightweight audio energy to mini player window for reactive background visualizer
  useEffect(() => {
    if (!isTauri()) return;
    if (!isPlaying) {
      // Send zero-energy state so mini visualizer gracefully settles
      emit('audio-energy', {
        bass: 0,
        mid: 0,
        peak: 0,
        bars: [0, 0, 0, 0, 0, 0, 0, 0],
      }).catch(() => {});
      return;
    }

    const interval = setInterval(() => {
      const energy = audioVisualizer.getEnergy(true);
      const freq = audioVisualizer.getFrequencyData();
      const bars: number[] = [];
      const step = Math.max(1, Math.floor(freq.length / 16));
      for (let i = 0; i < 8; i++) {
        bars.push(Math.round(((freq[i * step] || 0) / 255) * 100) / 100);
      }
      emit('audio-energy', {
        bass: Math.round(energy.bass * 100) / 100,
        mid: Math.round(energy.mid * 100) / 100,
        peak: Math.round(energy.peak * 100) / 100,
        bars,
      }).catch(() => {});
    }, 45); // ~22 FPS

    return () => clearInterval(interval);
  }, [isPlaying]);

  // 11. Listen for actions from mini window (mounted once, desktop only)
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;

    listen<{ action: string; payload: string | null }>('mini-action', (event) => {
      const { action, payload } = event.payload;
      const parsed = payload ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : null;
      const player = usePlayerStore.getState();
      const lyricsStore = useLyricsStore.getState();
      const now = Date.now();

      switch (action) {
        case 'request_state':
          emitFullStateRef.current();
          if (audioRef.current) {
            invoke('cmd_emit_player_time', {
              currentTime: audioRef.current.currentTime,
              activeLineIndex: lyricsStore.activeLineIndex,
            }).catch(() => {});
          }
          break;
        case 'toggle_play': {
          player.togglePlay();
          break;
        }
        case 'next':
          if (now - lastSkipActionRef.current > 300) {
            lastSkipActionRef.current = now;
            player.playNext();
          }
          break;
        case 'prev':
          if (now - lastSkipActionRef.current > 300) {
            lastSkipActionRef.current = now;
            player.playPrev();
          }
          break;
        case 'like':
          if (parsed) player.toggleLike(parsed);
          break;
        case 'seek':
          if (typeof parsed === 'number') {
            player.seek(parsed);
            if (audioRef.current) {
              audioRef.current.currentTime = parsed;
              invoke('cmd_emit_player_time', {
                currentTime: parsed,
                activeLineIndex: lyricsStore.activeLineIndex,
              }).catch(() => {});
            }
          }
          break;
        case 'set_volume':
          if (typeof parsed === 'number') player.setVolume(parsed);
          break;
        case 'toggle_mute':
          player.toggleMute();
          break;
        case 'open_eq':
        case 'open_eq_full':
          window.dispatchEvent(new CustomEvent('open-equalizer'));
          if (action === 'open_eq_full') {
            invoke('cmd_restore_main').catch(() => {});
          }
          break;
        case 'set_eq_preset':
          if (typeof parsed === 'string') {
            useEqualizerStore.getState().setPreset(parsed as any);
          }
          break;
        case 'start_wave':
          player.startWave();
          break;
        case 'start_custom_wave':
          // parsed IS already the options object (activity/mood/character/language)
          if (parsed && (parsed.activity || parsed.mood || parsed.character || parsed.language)) {
            player.startCustomWave(parsed);
          } else {
            player.startWave();
          }
          break;
        case 'shuffle_liked': {
          const likedQueue = Array.from(player.likedIds);
          if (likedQueue.length > 0) {
            player.startWave();
          }
          break;
        }
        case 'play_queue_index':
          if (typeof parsed === 'number') {
            const q = player.queue;
            if (q[parsed]) {
              player.playTrack(q[parsed], q, parsed);
            }
          }
          break;
        case 'move_queue_item':
          if (parsed && typeof parsed.from === 'number' && typeof parsed.to === 'number') {
            player.moveQueueItem(parsed.from, parsed.to);
          }
          break;
        case 'remove_from_queue':
          if (typeof parsed === 'number') {
            player.removeFromQueue(parsed);
          }
          break;
      }
    }).then((u) => { unlisten = u; });

    return () => { if (unlisten) unlisten(); };
  }, []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      crossOrigin="anonymous"
      playsInline
      style={{ display: 'none' }}
    />
  );
}
