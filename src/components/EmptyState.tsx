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
        'flex flex-col items-center justify-center rounded-card border border-line bg-surface px-6 py-16 text-center shadow-card',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-brand-50 to-brand-100 text-brand-600 ring-1 ring-inset ring-brand-100">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
