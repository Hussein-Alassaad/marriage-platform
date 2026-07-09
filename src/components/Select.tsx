import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-12 w-full rounded-md border border-line bg-surface px-3.5 text-[15px] text-ink',
          'transition-[border-color,box-shadow] duration-150 hover:border-line-strong',
          'focus-visible:border-brand-400 focus-visible:outline-none focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
