import { useRef, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

export interface SwipeGestureOptions {
  /** Direction to enable: 'horizontal' | 'vertical' | 'both' */
  direction?: 'horizontal' | 'vertical' | 'both';
  /** Distance threshold in px to commit action (default: 70px) */
  threshold?: number;
  /** Velocity threshold in px/ms to trigger flick (default: 0.45) */
  velocityThreshold?: number;
  /** Deadzone before locking direction (default: 8px) */
  lockThreshold?: number;
  /** Ignore swipes starting within edgeOffset from screen edges (default: 24px) */
  edgeOffset?: number;
  /** Whether to apply rubber-band resistance */
  rubberBand?: boolean;
  /** Rubber-band exponent (0 to 1, default: 0.75) */
  rubberBandFactor?: number;
  /** Callback during tracking: (deltaX, deltaY, percentToThreshold) */
  onSwiping?: (dx: number, dy: number, progress: number) => void;
  /** Callback when swiping left commits */
  onSwipeLeft?: () => void;
  /** Callback when swiping right commits */
  onSwipeRight?: () => void;
  /** Callback when swiping up commits */
  onSwipeUp?: () => void;
  /** Callback when swiping down commits */
  onSwipeDown?: () => void;
  /** Callback when gesture ends without committing */
  onCancel?: () => void;
  /** Callback when gesture starts */
  onStart?: () => void;
  /** Auto reset transform on cancel with CSS transition (default: true) */
  autoResetTransform?: boolean;
}

export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  options: SwipeGestureOptions
) {
  const {
    direction = 'horizontal',
    threshold = 70,
    velocityThreshold = 0.45,
    lockThreshold = 8,
    edgeOffset = 24,
    rubberBand = true,
    rubberBandFactor = 0.75,
    onSwiping,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onCancel,
    onStart,
    autoResetTransform = true,
  } = options;

  const targetRef = useRef<T | null>(null);

  // State refs (no react re-render during drag!)
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    recentTouches: [] as Array<{ x: number; y: number; t: number }>,
    directionLock: null as 'horizontal' | 'vertical' | 'none' | null,
    isTracking: false,
    thresholdCrossed: false,
    rafId: 0,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      // iOS Safari Edge swipe back protection
      if (edgeOffset > 0) {
        if (touch.clientX < edgeOffset || touch.clientX > window.innerWidth - edgeOffset) {
          return;
        }
      }

      const now = performance.now();
      const state = stateRef.current;
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.currentX = touch.clientX;
      state.currentY = touch.clientY;
      state.startTime = now;
      state.recentTouches = [{ x: touch.clientX, y: touch.clientY, t: now }];
      state.directionLock = null;
      state.isTracking = true;
      state.thresholdCrossed = false;

      if (targetRef.current) {
        targetRef.current.style.transition = 'none';
        targetRef.current.style.willChange = 'transform';
      }

      optionsRef.current.onStart?.();
    },
    [edgeOffset]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const state = stateRef.current;
      if (!state.isTracking || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const now = performance.now();
      state.currentX = touch.clientX;
      state.currentY = touch.clientY;

      state.recentTouches.push({ x: touch.clientX, y: touch.clientY, t: now });
      if (state.recentTouches.length > 5) {
        state.recentTouches.shift();
      }

      let dx = state.currentX - state.startX;
      let dy = state.currentY - state.startY;

      // 1. Direction locking check
      if (state.directionLock === null) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const maxDelta = Math.max(absX, absY);

        if (maxDelta > lockThreshold) {
          if (direction === 'horizontal') {
            state.directionLock = absX > absY ? 'horizontal' : 'vertical';
          } else if (direction === 'vertical') {
            state.directionLock = absY > absX ? 'vertical' : 'horizontal';
          } else {
            state.directionLock = 'none';
          }
        } else {
          return; // Still in deadzone
        }
      }

      // If locked into forbidden direction, stop tracking
      if (direction === 'horizontal' && state.directionLock === 'vertical') {
        return;
      }
      if (direction === 'vertical' && state.directionLock === 'horizontal') {
        return;
      }

      // Prevent native scroll when actively gesturing
      if (e.cancelable) {
        e.preventDefault();
      }

      // 2. Rubber-banding computation
      let effectiveDx = dx;
      let effectiveDy = dy;

      if (rubberBand) {
        if (direction === 'horizontal') {
          effectiveDy = 0;
          effectiveDx = Math.sign(dx) * Math.pow(Math.abs(dx), rubberBandFactor) * 2;
        } else if (direction === 'vertical') {
          effectiveDx = 0;
          effectiveDy = Math.sign(dy) * Math.pow(Math.abs(dy), rubberBandFactor) * 2;
        }
      }

      // 3. Threshold check for haptic tick
      const primaryDelta = direction === 'vertical' ? Math.abs(effectiveDy) : Math.abs(effectiveDx);
      const isPastThreshold = primaryDelta >= threshold;

      if (isPastThreshold && !state.thresholdCrossed) {
        state.thresholdCrossed = true;
        triggerHaptic('selection');
      } else if (!isPastThreshold && state.thresholdCrossed) {
        state.thresholdCrossed = false;
      }

      const progress = Math.min(1, primaryDelta / threshold);

      // 4. Direct DOM transform via rAF for 60fps GPU smoothness
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = requestAnimationFrame(() => {
        if (targetRef.current) {
          if (direction === 'horizontal') {
            targetRef.current.style.transform = `translate3d(${effectiveDx}px, 0, 0)`;
          } else if (direction === 'vertical') {
            targetRef.current.style.transform = `translate3d(0, ${effectiveDy}px, 0)`;
          } else {
            targetRef.current.style.transform = `translate3d(${effectiveDx}px, ${effectiveDy}px, 0)`;
          }
        }
        optionsRef.current.onSwiping?.(effectiveDx, effectiveDy, progress);
      });
    },
    [direction, lockThreshold, rubberBand, rubberBandFactor, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    const state = stateRef.current;
    if (!state.isTracking) return;
    state.isTracking = false;

    if (state.rafId) cancelAnimationFrame(state.rafId);

    // Compute velocity (px/ms) using recent touch history
    let vx = 0;
    let vy = 0;
    if (state.recentTouches.length >= 2) {
      const first = state.recentTouches[0];
      const last = state.recentTouches[state.recentTouches.length - 1];
      const dt = Math.max(1, last.t - first.t);
      vx = (last.x - first.x) / dt;
      vy = (last.y - first.y) / dt;
    }

    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;

    const isHorizontal = direction === 'horizontal' || (direction === 'both' && Math.abs(dx) > Math.abs(dy));
    const isVertical = direction === 'vertical' || (direction === 'both' && Math.abs(dy) >= Math.abs(dx));

    let committed = false;

    if (isHorizontal && state.directionLock !== 'vertical') {
      const absDx = Math.abs(dx);
      const isQuickFlick = Math.abs(vx) > velocityThreshold && absDx > 25;
      const reachedDistance = absDx >= threshold;

      if (reachedDistance || isQuickFlick) {
        const goingRight = dx > 0 || (isQuickFlick && vx > 0);
        if (goingRight && optionsRef.current.onSwipeRight) {
          committed = true;
          triggerHaptic('light');
          optionsRef.current.onSwipeRight();
        } else if (!goingRight && optionsRef.current.onSwipeLeft) {
          committed = true;
          triggerHaptic('light');
          optionsRef.current.onSwipeLeft();
        }
      }
    } else if (isVertical && state.directionLock !== 'horizontal') {
      const absDy = Math.abs(dy);
      const isQuickFlick = Math.abs(vy) > velocityThreshold && absDy > 25;
      const reachedDistance = absDy >= threshold;

      if (reachedDistance || isQuickFlick) {
        const goingDown = dy > 0 || (isQuickFlick && vy > 0);
        if (goingDown && optionsRef.current.onSwipeDown) {
          committed = true;
          triggerHaptic('light');
          optionsRef.current.onSwipeDown();
        } else if (!goingDown && optionsRef.current.onSwipeUp) {
          committed = true;
          triggerHaptic('light');
          optionsRef.current.onSwipeUp();
        }
      }
    }

    // Reset element transform
    if (targetRef.current) {
      if (autoResetTransform || !committed) {
        targetRef.current.style.transition = 'transform 0.24s cubic-bezier(0.25, 1, 0.5, 1)';
        targetRef.current.style.transform = 'translate3d(0, 0, 0)';
        setTimeout(() => {
          if (targetRef.current) {
            targetRef.current.style.willChange = 'auto';
          }
        }, 240);
      } else {
        targetRef.current.style.willChange = 'auto';
      }
    }

    if (!committed) {
      optionsRef.current.onCancel?.();
    }
  }, [autoResetTransform, direction, threshold, velocityThreshold]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

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
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { targetRef };
}
