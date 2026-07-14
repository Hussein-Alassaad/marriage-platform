import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';

interface AmbientParticlesProps {
  className?: string;
  /** Keep low for performance (default 14). */
  count?: number;
}

/**
 * Slow-drifting ambient dust (§ background). Deliberately low count and
 * transform/opacity-only, so it costs almost nothing. Each mote rises gently
 * and breathes in opacity on its own timing. Disabled under reduced motion.
 */
export function AmbientParticles({ className, count = 14 }: AmbientParticlesProps) {
  const reduced = useReducedMotion();
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 61.8) % 100}%`,
        top: `${(i * 37.1) % 100}%`,
        size: 2 + (i % 3),
        drift: 18 + (i % 5) * 6,
        duration: 9 + (i % 6) * 2,
        delay: (i % 7) * 0.9,
        gold: i % 5 === 0,
      })),
    [count],
  );

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {motes.map((m) => (
        <motion.span
          key={m.id}
          className="absolute rounded-full"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            backgroundColor: m.gold ? 'var(--color-gold-400)' : 'var(--color-brand-400)',
            boxShadow: m.gold ? '0 0 8px rgba(201,162,39,0.5)' : '0 0 8px rgba(52,211,153,0.5)',
          }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.55, 0], y: [0, -m.drift, -m.drift * 1.6] }}
          transition={{ duration: m.duration, delay: m.delay, ease: 'easeInOut', repeat: Infinity }}
        />
      ))}
    </div>
  );
}
