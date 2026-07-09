import { useRef } from 'react';
import { useInView } from 'framer-motion';

import { cn } from '@/utils/cn';
import { useCountUp } from '@/hooks/useCountUp';

interface CountUpProps {
  value: number;
  /** Decimal places. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Milliseconds (default 1200 per spec). */
  duration?: number;
  /** Thousands grouping. */
  grouped?: boolean;
}

/**
 * Counts up to `value` once, when it scrolls into view (§3 CountUp), 1.2s
 * ease-out. Always tabular-nums so digits don't jitter. Reduced motion is
 * handled inside useCountUp (jumps to the target).
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  duration = 1200,
  grouped = false,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const current = useCountUp(value, inView, { duration });
  const formatted = grouped
    ? current.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : current.toFixed(decimals);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
