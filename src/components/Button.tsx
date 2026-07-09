import { forwardRef, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_OUT_EXPO, springMicro } from '@/lib/motion';
import { usePointerFine } from '@/hooks/usePointerFine';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Subtly pull toward the cursor on approach (fine pointers only). */
  magnetic?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] shadow-xs hover:bg-[var(--btn-primary-bg-hover)]',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  outline: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-canvas',
  ghost: 'text-muted hover:bg-canvas hover:text-ink',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[0.95rem]',
};

// Lift + scale on hover (fine pointers); a firmer push on tap (every device).
const feedbackVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2 },
  tap: { scale: 0.96, y: 0 },
};

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', magnetic = false, type = 'button', children, onPointerDown, ...props },
  ref,
) {
  const reduced = useReducedMotion();
  const pointerFine = usePointerFine();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const rippleId = useRef(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 400, damping: 30 });
  const y = useSpring(my, { stiffness: 400, damping: 30 });

  const magneticOn = magnetic && pointerFine && !reduced;
  const isPrimary = variant === 'primary';

  const handleMagnet = (event: PointerEvent<HTMLSpanElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-5, Math.min(5, v * 0.35));
    mx.set(clamp(event.clientX - (rect.left + rect.width / 2)));
    my.set(clamp(event.clientY - (rect.top + rect.height / 2)));
  };

  const resetMagnet = () => {
    mx.set(0);
    my.set(0);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // Tap ripple — the press feedback that works on touch (and mouse).
    if (!reduced) {
      const rect = event.currentTarget.getBoundingClientRect();
      const id = rippleId.current++;
      setRipples((rs) => [...rs, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }]);
    }
    onPointerDown?.(event);
  };

  return (
    <motion.span
      ref={wrapRef}
      style={{ x, y }}
      className="relative inline-flex"
      onPointerMove={magneticOn ? handleMagnet : undefined}
      onPointerLeave={magneticOn ? resetMagnet : undefined}
    >
      {isPrimary ? (
        // Persistent, low-opacity conic glow — the main action quietly breathes.
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-0 rounded-2xl opacity-45 blur-md"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, var(--color-brand-400), transparent 40%, var(--color-brand-600), transparent 75%, var(--color-brand-400))',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, ease: 'linear', repeat: Infinity }}
        />
      ) : null}

      <motion.button
        ref={ref}
        type={type}
        onPointerDown={handlePointerDown}
        className={cn(
          'relative isolate inline-flex items-center justify-center overflow-hidden rounded-xl font-medium',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileTap="tap"
        variants={feedbackVariants}
        transition={springMicro}
        {...props}
      >
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            aria-hidden
            className="pointer-events-none absolute h-[120px] w-[120px] rounded-full"
            style={{
              left: ripple.x,
              top: ripple.y,
              marginLeft: -60,
              marginTop: -60,
              background: 'radial-gradient(circle, currentColor 0%, transparent 70%)',
            }}
            initial={{ scale: 0, opacity: 0.3 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            onAnimationComplete={() =>
              setRipples((rs) => rs.filter((r) => r.id !== ripple.id))
            }
          />
        ))}
        <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
      </motion.button>
    </motion.span>
  );
});
