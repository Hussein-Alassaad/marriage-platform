import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { EASE_EXPO, inViewOnce } from '@/lib/motion';

interface FadeRiseProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before the entrance plays. */
  delay?: number;
  /** Rise distance in px. */
  y?: number;
  /** Adds a soft blur-in (hero use only). */
  blur?: boolean;
  /** Play immediately on mount instead of waiting for scroll-in. */
  immediate?: boolean;
}

/**
 * The workhorse entrance (§3 FadeRise): opacity + rise, once, ease-out-expo.
 * Reduced motion collapses it to a plain fade with no transform/blur.
 */
export function FadeRise({
  children,
  className,
  delay = 0,
  y = 24,
  blur = false,
  immediate = false,
}: FadeRiseProps) {
  const reduced = useReducedMotion();
  const hidden = reduced
    ? { opacity: 0 }
    : { opacity: 0, y, filter: blur ? 'blur(6px)' : 'blur(0px)' };
  const shown = { opacity: 1, y: 0, filter: 'blur(0px)' };

  const activation = immediate
    ? { animate: shown }
    : { whileInView: shown, viewport: inViewOnce };

  return (
    <motion.div
      className={className}
      initial={hidden}
      {...activation}
      transition={{ duration: 0.55, ease: EASE_EXPO, delay }}
    >
      {children}
    </motion.div>
  );
}
