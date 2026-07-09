import { type Transition, type Variants } from 'framer-motion';

/**
 * Motion tokens — the single source of truth for easing, springs, and durations.
 * Nothing in the app hand-tunes these; every animated primitive imports them so
 * motion feels like one deliberate system (ban on ease/linear/ease-in-out).
 */

/** ease-out-expo — the "premium" curve: fast start, soft landing. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Micro-interactions: hover / tap feedback. */
export const springMicro: Transition = { type: 'spring', stiffness: 400, damping: 30 };

/** Layout shifts: shared-element slides (nav indicator). */
export const springLayout: Transition = { type: 'spring', stiffness: 300, damping: 35, mass: 0.8 };

/** Durations in seconds. Nothing here exceeds 0.8s (count-up is a value tween, not a transform). */
export const durations = {
  hover: 0.15,
  reveal: 0.5,
  page: 0.3,
  hero: 0.6,
  sheen: 0.6,
} as const;

/** Scroll/entrance reveal: opacity + 20px rise, ease-out-expo. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.reveal, ease: EASE_OUT_EXPO } },
};

/** Stagger parent: children reveal 70ms apart, never as one block. */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
