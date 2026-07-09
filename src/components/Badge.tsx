import { type HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  withDot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-canvas text-muted ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-brand-50 text-success ring-brand-100',
  warning: 'bg-amber-50 text-warning ring-amber-100',
  danger: 'bg-red-50 text-danger ring-red-100',
  info: 'bg-blue-50 text-info ring-blue-100',
};

export function Badge({ className, variant = 'neutral', withDot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {withDot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden /> : null}
      {children}
    </span>
  );
}
