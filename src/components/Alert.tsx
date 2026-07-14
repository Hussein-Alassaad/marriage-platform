import { type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type AlertVariant = 'danger' | 'success' | 'info';

const variantClasses: Record<AlertVariant, string> = {
  danger: 'bg-danger-wash text-danger ring-danger/25',
  success: 'bg-success-wash text-success ring-success/25',
  info: 'bg-info-wash text-info ring-info/25',
};

export function Alert({
  variant = 'danger',
  children,
}: {
  variant?: AlertVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('rounded-md px-3.5 py-2.5 text-sm ring-1 ring-inset', variantClasses[variant])}
      role="alert"
    >
      {children}
    </div>
  );
}
