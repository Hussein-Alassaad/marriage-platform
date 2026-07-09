import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_INOUT } from '@/lib/motion';

interface AuthMascotProps {
  className?: string;
}

/**
 * A friendly, on-brand emerald character that leans in and "pushes" the auth
 * card — a playful welcome on the sign-in / register screens. Purely decorative
 * (aria-hidden), self-contained SVG, themed to the platform. It leans forward
 * and eases back in a loop so it reads as pushing; reduced motion holds a static
 * lean. Mirrors under RTL via the parent. Hidden on small screens.
 */
export function AuthMascot({ className }: AuthMascotProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className={cn('pointer-events-none select-none', className)}
      // Idle float for the whole figure.
      animate={reduced ? undefined : { y: [0, -4, 0] }}
      transition={{ duration: 4, ease: EASE_INOUT, repeat: Infinity }}
    >
      <svg width="220" height="340" viewBox="0 0 220 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mascotBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-400)" />
            <stop offset="100%" stopColor="var(--color-brand-600)" />
          </linearGradient>
          <linearGradient id="mascotHead" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-300)" />
            <stop offset="100%" stopColor="var(--color-brand-500)" />
          </linearGradient>
        </defs>

        {/* Ground shadow. */}
        <ellipse cx="96" cy="326" rx="60" ry="9" fill="rgb(0 0 0 / 0.18)" />

        {/* The figure leans forward and eases back — the "push". Origin at feet. */}
        <motion.g
          style={{ originX: '96px', originY: '320px' }}
          animate={reduced ? { rotate: 4 } : { rotate: [0, 5, 0], x: [0, 6, 0] }}
          transition={{ duration: 2.4, ease: EASE_INOUT, repeat: Infinity }}
        >
          {/* Legs */}
          <rect x="74" y="228" width="18" height="92" rx="9" fill="url(#mascotBody)" />
          <rect x="100" y="228" width="18" height="92" rx="9" fill="url(#mascotBody)" />
          <ellipse cx="83" cy="322" rx="16" ry="8" fill="var(--color-brand-700)" />
          <ellipse cx="109" cy="322" rx="16" ry="8" fill="var(--color-brand-700)" />

          {/* Torso */}
          <rect x="66" y="118" width="60" height="120" rx="26" fill="url(#mascotBody)" />
          {/* subtle collar highlight */}
          <path d="M78 128 q18 16 36 0" stroke="var(--color-brand-300)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />

          {/* Head */}
          <g>
            {/* neck */}
            <rect x="88" y="96" width="16" height="20" rx="8" fill="var(--color-brand-500)" />
            <circle cx="96" cy="66" r="34" fill="url(#mascotHead)" />
            {/* hair cap */}
            <path d="M64 60 a32 32 0 0 1 64 0 q-32 -22 -64 0 z" fill="var(--color-brand-700)" />
            {/* cool sunglasses */}
            <g fill="#0a0f0d">
              <rect x="72" y="60" width="20" height="13" rx="5" />
              <rect x="100" y="60" width="20" height="13" rx="5" />
              <rect x="92" y="64" width="8" height="3" rx="1.5" />
            </g>
            {/* lens glints */}
            <rect x="75" y="62" width="6" height="3" rx="1.5" fill="var(--color-brand-300)" opacity="0.8" />
            <rect x="103" y="62" width="6" height="3" rx="1.5" fill="var(--color-brand-300)" opacity="0.8" />
            {/* smile */}
            <path d="M86 82 q10 8 20 0" stroke="#0a0f0d" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>

          {/* Front (pushing) arm — reaches out to the card edge. Gives a little
              extra extension push in sync with the lean. */}
          <motion.g
            style={{ originX: '120px', originY: '138px' }}
            animate={reduced ? undefined : { rotate: [0, -6, 0] }}
            transition={{ duration: 2.4, ease: EASE_INOUT, repeat: Infinity }}
          >
            <rect x="116" y="130" width="80" height="16" rx="8" fill="url(#mascotBody)" />
            <circle cx="198" cy="138" r="13" fill="var(--color-brand-300)" />
          </motion.g>
        </motion.g>
      </svg>
    </motion.div>
  );
}
