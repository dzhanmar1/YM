/**
 * Micro-Haptics utility for gesture feedback on mobile devices.
 * Safely handles environments where navigator.vibrate is missing or restricted (e.g. iOS Safari).
 */

export type HapticStyle = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      switch (style) {
        case 'selection':
          // Subtle click (e.g. dragging past threshold, scrubbing)
          navigator.vibrate(6);
          break;
        case 'light':
          // Standard tactile feedback (e.g. track swipe commit)
          navigator.vibrate(10);
          break;
        case 'medium':
          // Solid interaction tick (e.g. full sheet dismiss, like action)
          navigator.vibrate(18);
          break;
        case 'heavy':
          // Strong feedback
          navigator.vibrate(28);
          break;
        case 'success':
          // Double micro-pulse (e.g. added to queue)
          navigator.vibrate([8, 40, 12]);
          break;
        case 'warning':
          navigator.vibrate([15, 60, 15]);
          break;
        case 'error':
          navigator.vibrate([20, 50, 20, 50, 30]);
          break;
      }
    }
  } catch {
    // Fail silently in environments blocking vibration API
  }
}
