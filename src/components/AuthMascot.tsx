import { type MotionValue, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_EXPO, EASE_INOUT } from '@/lib/motion';

interface AuthMascotProps {
  className?: string;
  /**
   * Shared 0→1 push phase. Peak (~0.55) is the moment the hand contacts the
   * card, so the parent can recoil the card in sync. Omit for an idle-only
   * character (e.g. the mobile placement above the card).
   */
  pushPhase?: MotionValue<number>;
  /**
   * Optional transparent PNG / rendered 3D frame. When provided it replaces the
   * built-in SVG while keeping the exact same push + idle interactions — drop in
   * a real asset later with no other change.
   */
  src?: string;
  /** Entrance delay (seconds). */
  delay?: number;
}

/**
 * A premium, on-brand character who leans in and pushes the auth card. Built
 * with layered SVG gradients + a soft shadow for a 3D-style look (swap in a real
 * asset via `src`). Entrance on mount, continuous idle breathing, and a lean/arm
 * push driven by `pushPhase`. Purely decorative; reduced motion holds it still.
 */
export function AuthMascot({ className, pushPhase, src, delay = 0.15 }: AuthMascotProps) {
  const reduced = useReducedMotion();
  const fallback = useMotionValue(0);
  const phase = pushPhase ?? fallback;

  const leanRotate = useTransform(phase, [0, 0.55, 1], [0, 5, 0]);
  const leanX = useTransform(phase, [0, 0.55, 1], [0, 7, 0]);
  const armRotate = useTransform(phase, [0, 0.55, 1], [0, -7, 0]);

  const entrance = reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, x: -28, scale: 0.94 },
        animate: {
          opacity: 1,
          x: 0,
          scale: 1,
          transition: { duration: 0.7, ease: EASE_EXPO, delay },
        },
      };

  const content = src ? (
    <motion.img
      src={src}
      alt=""
      className="h-[340px] w-auto"
      style={{ x: leanX, rotate: leanRotate, transformOrigin: 'bottom center' }}
    />
  ) : (
    <svg width="220" height="340" viewBox="0 0 220 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mHead" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--color-brand-300)" />
          <stop offset="55%" stopColor="var(--color-brand-500)" />
          <stop offset="100%" stopColor="var(--color-brand-700)" />
        </radialGradient>
        <radialGradient id="mBody" cx="35%" cy="22%" r="90%">
          <stop offset="0%" stopColor="var(--color-brand-400)" />
          <stop offset="60%" stopColor="var(--color-brand-500)" />
          <stop offset="100%" stopColor="var(--color-brand-700)" />
        </radialGradient>
        <filter id="mSoft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Soft ground shadow. */}
      <ellipse cx="96" cy="326" rx="58" ry="9" fill="rgb(0 0 0 / 0.22)" filter="url(#mSoft)" />

      <motion.g style={{ rotate: leanRotate, x: leanX, originX: '96px', originY: '320px' }}>
        {/* Legs */}
        <rect x="74" y="228" width="18" height="92" rx="9" fill="url(#mBody)" />
        <rect x="100" y="228" width="18" height="92" rx="9" fill="url(#mBody)" />
        <ellipse cx="83" cy="322" rx="16" ry="8" fill="var(--color-brand-700)" />
        <ellipse cx="109" cy="322" rx="16" ry="8" fill="var(--color-brand-700)" />

        {/* Torso with a highlight + rim light */}
        <rect x="66" y="118" width="60" height="120" rx="26" fill="url(#mBody)" />
        <rect x="72" y="126" width="20" height="96" rx="10" fill="var(--color-brand-300)" opacity="0.22" />
        <path
          d="M124 130 q4 46 -6 96"
          stroke="var(--color-brand-300)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />

        {/* Head */}
        <rect x="88" y="96" width="16" height="20" rx="8" fill="var(--color-brand-500)" />
        <circle cx="96" cy="66" r="34" fill="url(#mHead)" />
        <path d="M64 60 a32 32 0 0 1 64 0 q-32 -22 -64 0 z" fill="var(--color-brand-700)" />
        <circle cx="82" cy="52" r="10" fill="var(--color-brand-300)" opacity="0.4" />
        {/* Sunglasses */}
        <g fill="#0a0f0d">
          <rect x="72" y="60" width="20" height="13" rx="5" />
          <rect x="100" y="60" width="20" height="13" rx="5" />
          <rect x="92" y="64" width="8" height="3" rx="1.5" />
        </g>
        <rect x="75" y="62" width="6" height="3" rx="1.5" fill="var(--color-brand-300)" opacity="0.85" />
        <rect x="103" y="62" width="6" height="3" rx="1.5" fill="var(--color-brand-300)" opacity="0.85" />
        <path d="M86 82 q10 8 20 0" stroke="#0a0f0d" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Pushing arm — extends a touch further at the contact peak. */}
        <motion.g style={{ rotate: armRotate, originX: '120px', originY: '138px' }}>
          <rect x="116" y="130" width="80" height="16" rx="8" fill="url(#mBody)" />
          <circle cx="198" cy="138" r="13" fill="url(#mHead)" />
        </motion.g>
      </motion.g>
    </svg>
  );

  return (
    <motion.div
      aria-hidden
      className={cn('pointer-events-none select-none', className)}
      initial={entrance.initial}
      animate={entrance.animate}
    >
      {/* Idle breathing lives on an inner layer so it composes with the push. */}
      <motion.div
        animate={reduced ? undefined : { y: [0, -5, 0], scale: [1, 1.012, 1] }}
        transition={{ duration: 4.5, ease: EASE_INOUT, repeat: Infinity }}
        style={{ transformOrigin: 'bottom center' }}
      >
        {content}
      </motion.div>
    </motion.div>
  );
}
