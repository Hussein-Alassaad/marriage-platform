import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { EASE_OUT_EXPO, durations } from '@/lib/motion';

interface PageTransitionProps {
  /** Route key — a change triggers the crossfade. */
  pathname: string;
  children: ReactNode;
}

/**
 * Quick crossfade + 8px rise between routes, 300ms ease-out-expo.
 * `mode="wait"` lets the old page finish leaving before the new one enters.
 * Wraps only the routed content, so the shell (sidebar / top bar) stays put.
 */
export function PageTransition({ pathname, children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: durations.page, ease: EASE_OUT_EXPO }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
