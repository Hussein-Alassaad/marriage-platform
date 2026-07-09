import { useRef, type PointerEvent, type ReactNode } from 'react';
import { motion, useReducedMotion, useSpring } from 'framer-motion';

import { cn } from '@/utils/cn';
import { usePointerFine } from '@/hooks/usePointerFine';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  /** Max pull toward the cursor, px. */
  strength?: number;
}

/**
 * Presentational wrapper that gently pulls its child toward the cursor (§3
 * MagneticButton): max 6px, snappy spring, resets on leave. Fine pointers only.
 * Purely visual — it never intercepts clicks or changes the child's behaviour.
 */
export function MagneticButton({ children, className, strength = 6 }: MagneticButtonProps) {
  const reduced = useReducedMotion();
  const fine = usePointerFine();
  const enabled = fine && !reduced;
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 380, damping: 30 });
  const y = useSpring(0, { stiffness: 380, damping: 30 });

  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-strength, Math.min(strength, v * 0.4));
    x.set(clamp(e.clientX - (rect.left + rect.width / 2)));
    y.set(clamp(e.clientY - (rect.top + rect.height / 2)));
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      style={enabled ? { x, y } : undefined}
      onPointerMove={enabled ? onMove : undefined}
      onPointerLeave={enabled ? reset : undefined}
      className={cn('inline-flex', className)}
    >
      {children}
    </motion.span>
  );
}
