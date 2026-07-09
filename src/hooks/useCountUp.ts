import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface CountUpOptions {
  /** Milliseconds. ~1000ms per the motion spec (value tween, not a transform). */
  duration?: number;
  start?: number;
}

/**
 * Animate a number from `start` to `target` on first activation, using
 * requestAnimationFrame with an ease-out curve. Returns the current value;
 * callers own the formatting (commas, %, currency). Respects reduced motion by
 * jumping straight to the target.
 */
export function useCountUp(target: number, active: boolean, options: CountUpOptions = {}): number {
  const { duration = 1000, start = 0 } = options;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(active && !reduced ? start : target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setValue(target);
      return;
    }

    let startTime: number | null = null;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      setValue(start + (target - start) * easeOut(progress));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [active, target, duration, start, reduced]);

  return value;
}
