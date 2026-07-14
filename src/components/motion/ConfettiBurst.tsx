import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['#34D399', '#6EE7B7', '#E3C567', '#EFD9A7', '#FFFFFF'];
const COUNT = 28;

interface ConfettiBurstProps {
  /** When true, a single burst plays; parent unmounts it via onDone. */
  active: boolean;
  onDone?: () => void;
}

/**
 * The Barakah celebration (§3/§6): a one-shot emerald+gold confetti burst that
 * fires ONLY on milestone moments (journey step completed, match accepted,
 * profile 100%). No dependency — 28 particles fly up in a fan then fall under
 * gravity, rotating and fading. Skipped entirely under reduced motion.
 */
export function ConfettiBurst({ active, onDone }: ConfettiBurstProps) {
  const reduced = useReducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const angle = -90 + (Math.random() * 120 - 60); // fan ±60° from straight up
        const distance = 120 + Math.random() * 90;
        const rad = (angle * Math.PI) / 180;
        return {
          id: i,
          color: COLORS[i % COLORS.length],
          dx: Math.cos(rad) * distance,
          up: Math.sin(rad) * distance,
          rotate: (Math.random() * 3 - 1.5) * 360,
          delay: Math.random() * 0.08,
        };
      }),
    [],
  );

  if (reduced || !active) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-50 overflow-visible">
      <div className="absolute top-1/2 left-1/2">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute block h-[10px] w-[6px] rounded-[1px]"
            style={{ backgroundColor: p.color }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: p.dx,
              y: [0, p.up, p.up + 160],
              opacity: [1, 1, 0],
              rotate: p.rotate,
            }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: p.delay }}
            onAnimationComplete={p.id === COUNT - 1 ? onDone : undefined}
          />
        ))}
      </div>
    </div>
  );
}
