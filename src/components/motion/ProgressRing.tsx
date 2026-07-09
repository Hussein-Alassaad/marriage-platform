import { useId, useRef, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_EXPO } from '@/lib/motion';

interface ProgressRingProps {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  /** Centered content (e.g. a CountUp percentage or an avatar). */
  children?: ReactNode;
}

/**
 * Circular progress (§3 ProgressRing): an emerald→mint gradient arc draws in
 * over 1.1s ease-out-expo the first time it enters view. Stroke/opacity only.
 */
export function ProgressRing({ value, size = 64, stroke = 5, className, children }: ProgressRingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  const gradientId = useId();

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const target = circumference * (1 - clamped / 100);

  return (
    <div ref={ref} className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-brand-300)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border-1)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? target : circumference }}
          animate={{ strokeDashoffset: inView ? target : circumference }}
          transition={{ duration: 1.1, ease: EASE_EXPO }}
        />
      </svg>
      {children != null && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
