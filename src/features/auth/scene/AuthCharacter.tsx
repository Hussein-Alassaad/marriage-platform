import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_EXPO, EASE_INOUT } from '@/lib/motion';

interface AuthCharacterProps {
  variant: 'man' | 'woman';
  /** Entrance offset (parent applies dx() for RTL). */
  fromX: number;
  /** Mirror the art so it faces inward (true under RTL). */
  flip?: boolean;
  /** Optional rendered art (transparent PNG/WebP). Falls back to a silhouette. */
  src?: string;
  className?: string;
  delay?: number;
  bob?: number;
}

/**
 * A dignified figure approaching the threshold. Renders your character art when
 * it loads; until then (or on 404) a premium emerald silhouette stands in — so
 * the scene is whole now and upgrades the instant real art is dropped in. Slides
 * in from its own side, then breathes. Decorative (aria-hidden).
 */
export function AuthCharacter({ variant, fromX, flip, src, className, delay = 0.75, bob = 4.4 }: AuthCharacterProps) {
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      aria-hidden
      className={cn('pointer-events-none select-none', className)}
      initial={reduced ? { opacity: 0.001, x: 0 } : { opacity: 0, x: fromX }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: EASE_EXPO, delay }}
    >
      <motion.div
        className="relative h-full"
        animate={reduced ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: bob, ease: EASE_INOUT, repeat: Infinity }}
      >
        {/* Flip lives on this static layer so it never fights the animations. */}
        <div className="h-full" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
          {src ? (
            <img
              src={src}
              alt=""
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(false)}
              className="h-full w-auto object-contain"
              style={{ display: loaded ? 'block' : 'none' }}
            />
          ) : null}
          {!loaded ? <Silhouette variant={variant} /> : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Elegant, connected filled silhouette (no face), lit by a gradient + rim. */
function Silhouette({ variant }: { variant: 'man' | 'woman' }) {
  const g = useId();
  const rim = 'rgba(110,231,183,0.6)';
  return (
    <svg viewBox="0 0 260 540" className="h-full w-auto" fill="none" aria-hidden preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0.45" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-300)" />
          <stop offset="45%" stopColor="var(--color-brand-500)" />
          <stop offset="100%" stopColor="var(--color-brand-900)" />
        </linearGradient>
      </defs>
      {variant === 'man' ? (
        <g fill={`url(#${g})`}>
          {/* legs (behind torso, connected at the hip) */}
          <path d="M96 300 L100 512 Q100 524 114 524 Q126 524 126 512 L126 300 Z" />
          <path d="M134 300 L134 512 Q134 524 146 524 Q160 524 160 512 L164 300 Z" />
          {/* head + neck + shoulders + torso as one connected body */}
          <circle cx="126" cy="80" r="38" />
          <path d="M112 112 h28 v14 q34 6 44 44 L188 320 Q126 340 72 320 L82 170 Q92 132 112 126 Z" />
          {/* raised arm gently extended forward (toward the light) */}
          <path d="M170 196 Q214 184 240 196 Q249 204 240 214 Q214 206 168 224 Z" />
        </g>
      ) : (
        <g fill={`url(#${g})`}>
          {/* head + hijab drape */}
          <path d="M96 96 a44 42 0 0 1 88 0 q2 34 -10 54 l-68 0 q-12 -20 -10 -54 z" />
          {/* flowing abaya, connected to the drape, widening to the floor */}
          <path d="M104 150 Q140 132 176 150 L206 508 Q140 530 74 508 Z" />
          {/* raised arm gently extended forward (toward the light) */}
          <path d="M104 196 Q60 184 24 196 Q15 204 24 214 Q60 206 106 224 Z" />
        </g>
      )}
      {/* soft rim light on the light-facing edge */}
      <path
        d={variant === 'man' ? 'M182 150 q22 90 8 168' : 'M196 168 q22 170 4 320'}
        stroke={rim}
        strokeWidth="3"
        fill="none"
        opacity="0.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
