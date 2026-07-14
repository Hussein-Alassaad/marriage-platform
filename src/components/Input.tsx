import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'border-line text-ink h-12 w-full rounded-md border bg-[color-mix(in_srgb,var(--color-surface)_100%,transparent)] px-3.5 text-[15px]',
          'placeholder:text-faint',
          'transition-[border-color,box-shadow] duration-150',
          'hover:border-line-strong',
          'focus-visible:border-brand-400 focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)] focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
