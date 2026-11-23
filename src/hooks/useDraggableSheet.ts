import { useRef, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

export interface DraggableSheetOptions {
  /** Distance in px to trigger dismiss (default: 100px) */
  threshold?: number;
  /** Velocity in px/ms to trigger flick dismiss (default: 0.5) */
  velocityThreshold?: number;
  /** Callback when sheet is dismissed */
  onDismiss: () => void;
  /** Optional callback for tracking progress (0 = closed/dismissed, 1 = fully open) */
  onProgress?: (progress: number, currentY: number) => void;
  /** Selector for element that triggers drag (e.g. header or handle). If omitted, entire sheet is draggable */
  dragHandleSelector?: string;
  /** Ref to a scrollable container inside the sheet to coordinate pull-to-dismiss at scrollTop === 0 */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Whether the sheet is currently open (disables listeners when closed) */
  isOpen?: boolean;
}

export function useDraggableSheet<T extends HTMLElement = HTMLDivElement>(
  options: DraggableSheetOptions
) {
  const {
    threshold = 100,
    velocityThreshold = 0.5,
    onDismiss,
    onProgress,
    dragHandleSelector,
    scrollContainerRef,
    isOpen = true,
  } = options;

  const sheetRef = useRef<T | null>(null);

  const stateRef = useRef({
    startY: 0,
    currentY: 0,
    startX: 0,
    startTime: 0,
    isDragging: false,
    directionLocked: false,
    isHandleDrag: false,
    thresholdCrossed: false,
    recentTouches: [] as Array<{ y: number; t: number }>,
    rafId: 0,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isOpen || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const target = e.target as HTMLElement;

      // Check if touching a drag handle
      const isHandle = dragHandleSelector
        ? Boolean(target.closest(dragHandleSelector))
        : false;

      // Check if scroll container is at top
      const scrollEl = scrollContainerRef?.current;
      const isAtScrollTop = scrollEl ? scrollEl.scrollTop <= 2 : true;

      // Only initiate drag if at top or touching drag handle
      if (!isHandle && !isAtScrollTop) {
        return;
      }

      const now = performance.now();
      const state = stateRef.current;
      state.startY = touch.clientY;
      state.currentY = touch.clientY;
      state.startX = touch.clientX;
      state.startTime = now;
      state.isDragging = false;
      state.directionLocked = false;
      state.isHandleDrag = isHandle;
      state.thresholdCrossed = false;
      state.recentTouches = [{ y: touch.clientY, t: now }];

      if (sheetRef.current) {
        sheetRef.current.style.transition = 'none';
        sheetRef.current.style.willChange = 'transform';
      }
    },
    [dragHandleSelector, isOpen, scrollContainerRef]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isOpen || e.touches.length !== 1) return;
      const state = stateRef.current;
      const touch = e.touches[0];
      const now = performance.now();

      const dy = touch.clientY - state.startY;
      const dx = touch.clientX - state.startX;

      // Direction lock check
      if (!state.directionLocked) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX > 8 || absY > 8) {
          state.directionLocked = true;
          // If moving horizontally or scrolling up into negative territory without handle
          if (absX > absY) {
            state.isDragging = false;
            return;
          }
          if (dy < 0 && !state.isHandleDrag) {
            state.isDragging = false;
            return;
          }
          state.isDragging = true;
        } else {
          return; // Deadzone
        }
      }

      if (!state.isDragging) return;

      // Coordinate with scroll container: if user drags down when scrolled down, don't intercept
      const scrollEl = scrollContainerRef?.current;
      if (scrollEl && !state.isHandleDrag && scrollEl.scrollTop > 0) {
        state.isDragging = false;
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      state.currentY = touch.clientY;
      state.recentTouches.push({ y: touch.clientY, t: now });
      if (state.recentTouches.length > 5) state.recentTouches.shift();

      // Compute visual transform with rubber banding if pulled up
      let visualY = dy;
      if (dy < 0) {
        // Rubber-band resistance when pulling upwards
        visualY = -Math.pow(Math.abs(dy), 0.65) * 2;
      }

      // Check threshold for haptic tick
      const isPast = visualY >= threshold;
      if (isPast && !state.thresholdCrossed) {
        state.thresholdCrossed = true;
        triggerHaptic('selection');
      } else if (!isPast && state.thresholdCrossed) {
        state.thresholdCrossed = false;
      }

      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = requestAnimationFrame(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transform = `translate3d(0, ${Math.max(visualY, -30)}px, 0)`;
        }
        optionsRef.current.onProgress?.(Math.max(0, 1 - visualY / (window.innerHeight || 800)), visualY);
      });
    },
    [isOpen, scrollContainerRef, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    const state = stateRef.current;
    if (!state.isDragging) return;
    state.isDragging = false;

    if (state.rafId) cancelAnimationFrame(state.rafId);

    // Compute velocity (px/ms)
    let vy = 0;
    if (state.recentTouches.length >= 2) {
      const first = state.recentTouches[0];
      const last = state.recentTouches[state.recentTouches.length - 1];
      const dt = Math.max(1, last.t - first.t);
      vy = (last.y - first.y) / dt;
    }

    const dy = state.currentY - state.startY;
    const isQuickFlickDown = vy > velocityThreshold && dy > 30;
    const reachedThreshold = dy >= threshold;

    if (reachedThreshold || isQuickFlickDown) {
      // Dismiss committed!
      triggerHaptic('medium');
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.22s cubic-bezier(0.32, 0, 0.67, 0)';
        sheetRef.current.style.transform = 'translate3d(0, 100%, 0)';
      }
      setTimeout(() => {
        optionsRef.current.onDismiss();
      }, 200);
    } else {
      // Snap back to open position
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.26s cubic-bezier(0.18, 0.89, 0.32, 1.15)';
        sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
        setTimeout(() => {
          if (sheetRef.current) {
            sheetRef.current.style.willChange = 'auto';
          }
        }, 260);
      }
      optionsRef.current.onProgress?.(1, 0);
    }
  }, [threshold, velocityThreshold]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !isOpen) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      if (stateRef.current.rafId) cancelAnimationFrame(stateRef.current.rafId);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, isOpen]);

  return { sheetRef };
}
