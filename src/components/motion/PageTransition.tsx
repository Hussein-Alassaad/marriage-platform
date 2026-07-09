import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { EASE_EXPO } from '@/lib/motion';

interface PageTransitionProps {
  /** Route key — a change triggers the crossfade. */
  pathname: string;
  children: ReactNode;
}

/**
 * Route crossfade (§3 PageTransition): exit up 8px in 240ms, enter from 16px in
 * 420ms ease-out-expo. `mode="wait"` lets the old page finish leaving before the
 * new one enters. Wraps only the routed content — the shell stays put; router
 * logic is untouched.
 */
export function PageTransition({ pathname, children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_EXPO } }}
        exit={{ opacity: 0, y: -8, transition: { duration: 0.24, ease: EASE_EXPO } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
