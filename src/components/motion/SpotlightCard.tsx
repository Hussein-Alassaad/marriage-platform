import { forwardRef, useState, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Feature card with a cursor-tracked radial glow (§3 SpotlightCard): a 600px
 * emerald wash follows the pointer, fading out 200ms after it leaves. The card
 * itself keeps the standard surface + inner-highlight. Reduced motion / touch
 * simply gets a static card (no glow).
 */
export const SpotlightCard = forwardRef<HTMLDivElement, SpotlightCardProps>(function SpotlightCard(
  { children, className },
  ref,
) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const [active, setActive] = useState(false);
  const glow = useMotionTemplate`radial-gradient(600px circle at ${mx}px ${my}px, rgba(52,211,153,0.08), transparent 70%)`;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };

  return (
    <div
      ref={ref}
      onPointerMove={reduced ? undefined : onMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      className={cn(
        'relative overflow-hidden rounded-card border border-line bg-surface p-6',
        'shadow-card [box-shadow:var(--shadow-card),var(--inner-hi)]',
        className,
      )}
    >
      {!reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: glow }}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
});
