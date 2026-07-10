import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_INOUT, SPRING_SOFT } from '@/lib/motion';

/** A hanging ornate lantern on a thin chain: drops in, then sways + flickers. */
export function Lantern({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn('absolute origin-top', className)}
      initial={reduced ? { y: 0, opacity: 1 } : { y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...SPRING_SOFT, delay: 0.35 }}
    >
      <motion.div
        className="origin-top"
        animate={reduced ? undefined : { rotate: [-2, 2, -2] }}
        transition={{ duration: 5, ease: EASE_INOUT, repeat: Infinity }}
      >
        {/* warm glow */}
        <motion.span
          className="absolute left-1/2 top-10 h-24 w-24 -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(227,197,103,0.45), transparent 70%)' }}
          animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, ease: EASE_INOUT, repeat: Infinity }}
        />
        <svg width="48" height="90" viewBox="0 0 48 90" fill="none" className="relative">
          <line x1="24" y1="0" x2="24" y2="16" stroke="rgba(227,197,103,0.5)" strokeWidth="1.5" />
          <path
            d="M18 16 h12 l4 8 v34 q0 8 -10 8 t-10 -8 v-34 z"
            fill="rgba(201,162,39,0.16)"
            stroke="rgba(227,197,103,0.5)"
            strokeWidth="1.5"
          />
          <ellipse cx="24" cy="42" rx="6" ry="9" fill="rgba(239,217,167,0.85)" />
          <g stroke="rgba(227,197,103,0.4)" strokeWidth="1">
            <line x1="18" y1="30" x2="30" y2="30" />
            <line x1="17" y1="46" x2="31" y2="46" />
          </g>
          <circle cx="24" cy="70" r="3" fill="rgba(227,197,103,0.6)" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
