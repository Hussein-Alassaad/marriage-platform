import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';

/** Faint twinkling starfield behind the scene. Low count, opacity-only. */
export function Starfield({ className, count = 46 }: { className?: string; count?: number }) {
  const reduced = useReducedMotion();
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 53.13) % 100}%`,
        top: `${(i * 29.73) % 100}%`,
        size: 1 + (i % 2),
        duration: 3 + (i % 4),
        delay: (i % 6) * 0.5,
      })),
    [count],
  );

  return (
    <div aria-hidden className={cn('absolute inset-0 overflow-hidden', className)}>
      {stars.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
          initial={{ opacity: 0.18 }}
          animate={reduced ? { opacity: 0.28 } : { opacity: [0.1, 0.6, 0.1] }}
          transition={
            reduced
              ? undefined
              : { duration: s.duration, delay: s.delay, ease: 'easeInOut', repeat: Infinity }
          }
        />
      ))}
    </div>
  );
}
