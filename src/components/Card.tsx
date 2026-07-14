import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle hover lift + elevated shadow. */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-card border-line bg-surface border p-6 [box-shadow:var(--shadow-card),var(--inner-hi)]',
        interactive && 'lift cursor-default',
        className,
      )}
      {...props}
    />
  );
});

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-ink text-[0.95rem] font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-muted mt-1 text-sm leading-relaxed', className)} {...props} />;
}
