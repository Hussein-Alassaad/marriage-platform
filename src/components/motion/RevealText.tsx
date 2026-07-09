import { createElement, type ElementType } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { EASE_EXPO } from '@/lib/motion';

interface RevealTextProps {
  /** The headline text; split into words, each rising + un-blurring in sequence. */
  text: string;
  className?: string;
  /** Wrapper element (defaults to a span so it inherits the heading around it). */
  as?: ElementType;
  /** Seconds before the first word begins. */
  delay?: number;
}

const word = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

/**
 * Word-by-word headline reveal (§3 RevealText): each word rises 20px and
 * un-blurs, staggered 50ms, ease-out-expo. Plays on mount. Reduced motion
 * renders the text plainly with no animation.
 */
export function RevealText({ text, className, as = 'span', delay = 0 }: RevealTextProps) {
  const reduced = useReducedMotion();
  if (reduced) return createElement(as, { className }, text);

  const words = text.split(' ');
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.05, delayChildren: delay }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className="inline-block"
          style={{ marginInlineEnd: '0.28em' }}
          variants={word}
          transition={{ duration: 0.5, ease: EASE_EXPO }}
        >
          {w}
        </motion.span>
      ))}
    </motion.span>
  );
}
