import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';

interface AnimatedCheckProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/**
 * A checkmark whose path draws itself in 500ms (§3 AnimatedCheck) the first time
 * it mounts. Uses currentColor, so callers set the colour via text-*. Reduced
 * motion shows the finished check instantly.
 */
export function AnimatedCheck({ size = 16, className, strokeWidth = 2 }: AnimatedCheckProps) {
  const reduced = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('text-brand-400', className)}
      aria-hidden
    >
      <motion.path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      />
    </svg>
  );
}
