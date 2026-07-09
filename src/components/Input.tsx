import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-12 w-full rounded-md border border-line bg-[color-mix(in_srgb,var(--color-surface)_100%,transparent)] px-3.5 text-[15px] text-ink',
          'placeholder:text-faint',
          'transition-[border-color,box-shadow] duration-150',
          'hover:border-line-strong',
          'focus-visible:border-brand-400 focus-visible:outline-none focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
