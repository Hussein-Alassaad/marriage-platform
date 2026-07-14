import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-card border-line bg-surface flex flex-col items-center justify-center border px-6 py-16 text-center [box-shadow:var(--shadow-card),var(--inner-hi)]',
        className,
      )}
    >
      {Icon ? (
        <span className="bg-brand-wash text-brand-600 mb-5 flex h-14 w-14 [animation:breathe-float_4s_ease-in-out_infinite] items-center justify-center rounded-2xl ring-1 ring-[color:var(--color-border-accent)] ring-inset">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <h3 className="text-ink text-base font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted mt-2 max-w-sm text-sm leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
