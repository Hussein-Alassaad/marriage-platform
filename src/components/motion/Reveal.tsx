import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

import { revealVariants, staggerParent } from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reveal a single element once, when ~15% enters the viewport:
 * opacity 0→1 + translateY 20→0, ease-out-expo, 500ms. Never re-triggers.
 */
export function RevealOnScroll({ children, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={revealVariants}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps extends RevealProps {
  /** How far into view before the group reveals (0–1). */
  amount?: number;
}

/** A group whose children reveal in sequence (70ms apart), once, on scroll-in. */
export function Stagger({ children, className, amount = 0.15 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={staggerParent}
    >
      {children}
    </motion.div>
  );
}

/** A single staggered child. Must be rendered inside <Stagger>. */
export function StaggerItem({ children, className }: RevealProps) {
  return (
    <motion.div className={className} variants={revealVariants}>
      {children}
    </motion.div>
  );
}
