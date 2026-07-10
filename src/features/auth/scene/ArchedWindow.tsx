import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_EXPO } from '@/lib/motion';

/**
 * An ornate Islamic pointed-arch "window" glowing with warm gold light, a
 * mashrabiya lattice inside. Decorative; blooms in on mount. Mirror via the
 * parent (`rtl:-scale-x-100`).
 */
export function ArchedWindow({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const light = useId();
  const clip = useId();

  return (
    <motion.div
      aria-hidden
      className={cn('absolute', className)}
      initial={reduced ? { opacity: 0.85 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE_EXPO, delay: 0.5 }}
    >
      <svg viewBox="0 0 300 520" className="h-full w-full" fill="none">
        <defs>
          <radialGradient id={light} cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor="rgba(227,197,103,0.55)" />
            <stop offset="45%" stopColor="rgba(201,162,39,0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <clipPath id={clip}>
            <path d="M24 500 L24 190 Q150 24 276 190 L276 500 Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x="0" y="0" width="300" height="520" fill={`url(#${light})`} />
          {/* Mashrabiya lattice */}
          <g stroke="rgba(227,197,103,0.22)" strokeWidth="1.5">
            {[60, 100, 140, 180, 220, 260].map((x) => (
              <line key={`v${x}`} x1={x} y1="40" x2={x} y2="500" />
            ))}
            {[230, 290, 350, 410, 470].map((y, i) => (
              <line key={`h${i}`} x1="0" y1={y} x2="300" y2={y} />
            ))}
            {[0, 60, 120, 180, 240].map((o) => (
              <line key={`d${o}`} x1={o} y1="500" x2={o + 120} y2="140" opacity="0.5" />
            ))}
          </g>
        </g>
        <path
          d="M24 500 L24 190 Q150 24 276 190 L276 500"
          stroke="rgba(227,197,103,0.4)"
          strokeWidth="2.5"
          fill="none"
        />
      </svg>
    </motion.div>
  );
}
