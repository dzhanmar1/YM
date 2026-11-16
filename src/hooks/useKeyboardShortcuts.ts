import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

export function useKeyboardShortcuts() {
  const {
    currentTrack,
    currentTime,
    duration,
    volume,
    togglePlay,
    playNext,
    playPrev,
    toggleLike,
    toggleMute,
    seek,
    setVolume,
  } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input elements or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Shift + Right Arrow or KeyN: Next Track
      if ((e.shiftKey && e.code === 'ArrowRight') || (e.code === 'KeyN' && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        playNext();
        return;
      }

      // Shift + Left Arrow or KeyP: Previous Track
      if ((e.shiftKey && e.code === 'ArrowLeft') || (e.code === 'KeyP' && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        playPrev();
        return;
      }

      // ArrowRight: Seek forward 5s
      if (e.code === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault();
        const nextTime = Math.min(duration || Infinity, currentTime + 5);
        seek(nextTime);
        return;
      }

      // ArrowLeft: Seek backward 5s
      if (e.code === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault();
        const prevTime = Math.max(0, currentTime - 5);
        seek(prevTime);
        return;
      }

      // ArrowUp: Volume Up +5%
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(Math.min(1, Math.round((volume + 0.05) * 100) / 100));
        return;
      }

      // ArrowDown: Volume Down -5%
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(Math.max(0, Math.round((volume - 0.05) * 100) / 100));
        return;
      }

      // KeyL: Like / Unlike current track
      if (e.code === 'KeyL' && !e.ctrlKey && !e.altKey && currentTrack) {
        e.preventDefault();
        toggleLike(currentTrack);
        return;
      }

      // KeyM: Mute / Unmute
      if (e.code === 'KeyM' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleMute();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentTrack,
    currentTime,
    duration,
    volume,
    togglePlay,
    playNext,
    playPrev,
    toggleLike,
    toggleMute,
    seek,
    setVolume,
  ]);
}
