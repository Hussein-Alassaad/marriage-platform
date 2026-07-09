import { forwardRef, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, type HTMLMotionProps } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_EXPO, SPRING_SNAPPY } from '@/lib/motion';
import { usePointerFine } from '@/hooks/usePointerFine';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Subtly pull toward the cursor on approach (fine pointers only). */
  magnetic?: boolean;
  children?: ReactNode;
}

// MITHAQ §4.1 — washes/borders reference themed tokens so both palettes hold.
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'text-on-brand border border-brand-300/40 [background:linear-gradient(135deg,var(--color-brand-500),var(--color-brand-600))] [box-shadow:0_4px_16px_rgba(16,185,129,0.20),var(--inner-hi)] hover:brightness-[1.06] hover:[box-shadow:var(--glow-brand),var(--inner-hi)]',
  secondary:
    'bg-bg-3 text-ink border border-line-strong hover:bg-bg-4 hover:border-[color:var(--color-border-accent)]',
  outline: 'border border-line-strong bg-surface text-ink hover:border-[color:var(--color-border-accent)] hover:bg-bg-3',
  ghost: 'text-muted hover:bg-bg-3 hover:text-ink',
  gold: 'border border-gold-500/40 text-[color:var(--btn-gold-fg)] [background:var(--btn-gold-bg)] [box-shadow:0_4px_16px_rgba(201,162,39,0.24),var(--inner-hi)] hover:brightness-[1.05]',
  destructive:
    'bg-danger-wash text-danger border border-danger/25 hover:bg-danger/20',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-sm',
  md: 'h-11 gap-2 px-5 text-[15px]',
  lg: 'h-12 gap-2 px-6 text-[15px]',
};

// Calm feedback (Sakinah): a small lift on hover, a firm press on tap. No overshoot.
const feedbackVariants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -1, scale: 1 },
  tap: { scale: 0.97, y: 0 },
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
  const x = useSpring(mx, { stiffness: 380, damping: 30 });
  const y = useSpring(my, { stiffness: 380, damping: 30 });

  const magneticOn = magnetic && pointerFine && !reduced;

  const handleMagnet = (event: PointerEvent<HTMLSpanElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-6, Math.min(6, v * 0.4));
    mx.set(clamp(event.clientX - (rect.left + rect.width / 2)));
    my.set(clamp(event.clientY - (rect.top + rect.height / 2)));
  };

  const resetMagnet = () => {
    mx.set(0);
    my.set(0);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
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
      <motion.button
        ref={ref}
        type={type}
        onPointerDown={handlePointerDown}
        className={cn(
          'group relative isolate inline-flex items-center justify-center overflow-hidden rounded-md font-semibold',
          'transition-[filter,box-shadow,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'focus-visible:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--color-bg-0),0_0_0_4px_var(--color-brand-400)]',
          'disabled:pointer-events-none disabled:opacity-45',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileTap="tap"
        variants={feedbackVariants}
        transition={SPRING_SNAPPY}
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
            initial={{ scale: 0, opacity: 0.25 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_EXPO }}
            onAnimationComplete={() => setRipples((rs) => rs.filter((r) => r.id !== ripple.id))}
          />
        ))}
        <span className="relative z-10 inline-flex items-center justify-center gap-2 [&_svg:last-child]:transition-transform [&_svg:last-child]:duration-200 group-hover:[&_svg:last-child]:translate-x-0.5 rtl:group-hover:[&_svg:last-child]:-translate-x-0.5">
          {children}
        </span>
      </motion.button>
    </motion.span>
  );
});
