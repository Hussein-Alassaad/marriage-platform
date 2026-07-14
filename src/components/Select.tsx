import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'border-line bg-surface text-ink h-12 w-full rounded-md border px-3.5 text-[15px]',
          'hover:border-line-strong transition-[border-color,box-shadow] duration-150',
          'focus-visible:border-brand-400 focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)] focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
