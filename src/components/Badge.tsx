import { type HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export type BadgeVariant = 'neutral' | 'brand' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  withDot?: boolean;
  /** The status dot softly pulses (live/pending states). */
  pulse?: boolean;
}

// MITHAQ §4.7 — wash bg + tinted text + a ~25%-alpha ring, all themed tokens.
const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-bg-3 text-muted ring-line-strong',
  brand: 'bg-brand-wash text-brand-700 ring-[color:var(--color-border-accent)]',
  gold: 'bg-gold-wash text-gold-400 ring-gold-500/30',
  success: 'bg-success-wash text-success ring-success/25',
  warning: 'bg-warning-wash text-warning ring-warning/25',
  danger: 'bg-danger-wash text-danger ring-danger/25',
  info: 'bg-info-wash text-info ring-info/25',
};

export function Badge({
  className,
  variant = 'neutral',
  withDot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {withDot ? (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          {pulse ? (
            <span className="absolute inline-flex h-full w-full [animation:pulse-ring_2s_ease-out_infinite] rounded-full bg-current" />
          ) : null}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {children}
    </span>
  );
}
