import { forwardRef, type PointerEvent, type ReactNode } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';

import { cn } from '@/utils/cn';
import { usePointerFine } from '@/hooks/usePointerFine';

/** SpringOptions form of SPRING_GENTLE (useSpring wants options, not a Transition). */
const GENTLE = { stiffness: 260, damping: 30 } as const;

interface TiltCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Subtle 3D tilt toward the cursor (§3 TiltCard): max ±6°, gentle spring,
 * scales 1.01 while hovered. Fine pointers only; reduced motion / touch renders
 * a plain card. Transform-only, so it holds 60fps.
 */
export const TiltCard = forwardRef<HTMLDivElement, TiltCardProps>(function TiltCard(
  { children, className },
  ref,
) {
  const reduced = useReducedMotion();
  const fine = usePointerFine();
  const enabled = fine && !reduced;

  const px = useSpring(0, GENTLE);
  const py = useSpring(0, GENTLE);
  const scale = useSpring(1, GENTLE);
  const rotateX = useTransform(py, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(px, [-0.5, 0.5], [-6, 6]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
    scale.set(1);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={enabled ? onMove : undefined}
      onPointerEnter={enabled ? () => scale.set(1.01) : undefined}
      onPointerLeave={enabled ? reset : undefined}
      style={enabled ? { rotateX, rotateY, scale, transformPerspective: 900 } : undefined}
      className={cn(
        'rounded-card border-line bg-surface border p-6',
        '[box-shadow:var(--shadow-card),var(--inner-hi)]',
        className,
      )}
    >
      {children}
    </motion.div>
  );
});
