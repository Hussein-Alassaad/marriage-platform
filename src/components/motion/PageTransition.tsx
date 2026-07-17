import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { EASE_EXPO } from '@/lib/motion';

interface PageTransitionProps {
  /** Route key — a change remounts the content, which replays the enter. */
  pathname: string;
  children: ReactNode;
}

/**
 * Enter-only page transition.
 *
 * This used to use `AnimatePresence mode="wait"`, which holds the OLD page on screen
 * until its exit animation finishes before mounting the new one. With React Router's
 * `Outlet` that handoff can deadlock — the old page leaves, the new one never mounts,
 * and you are left on a blank screen until you refresh. That was the "it gets stuck on
 * an empty page when I switch sections" bug.
 *
 * Keying a plain `motion.div` on the pathname remounts the content the instant the route
 * changes and fades it in. There is no exit to wait for, so nothing can deadlock — the
 * new page is ALWAYS on screen immediately.
 */
export function PageTransition({ pathname, children }: PageTransitionProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_EXPO }}
    >
      {children}
    </motion.div>
  );
}
