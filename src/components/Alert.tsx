import { type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type AlertVariant = 'danger' | 'success' | 'info';

const variantClasses: Record<AlertVariant, string> = {
  danger: 'bg-red-50 text-danger ring-red-100',
  success: 'bg-brand-50 text-success ring-brand-100',
  info: 'bg-blue-50 text-info ring-blue-100',
};

export function Alert({ variant = 'danger', children }: { variant?: AlertVariant; children: ReactNode }) {
  return (
    <div className={cn('rounded-lg px-3 py-2 text-sm ring-1 ring-inset', variantClasses[variant])} role="alert">
      {children}
    </div>
  );
}
