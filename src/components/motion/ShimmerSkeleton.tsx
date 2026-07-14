import { cn } from '@/utils/cn';

interface ShimmerSkeletonProps {
  className?: string;
}

/**
 * Loading placeholder (§3 ShimmerSkeleton): a faint surface with a slow sweep.
 * Radius/size come from `className` so it can mirror the real content it stands
 * in for. The sweep is defined in index.css (`.shimmer`) and is paused under
 * reduced motion by the global media query.
 */
export function ShimmerSkeleton({ className }: ShimmerSkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'shimmer rounded-md bg-[color-mix(in_srgb,var(--color-text-1)_5%,transparent)]',
        className,
      )}
    />
  );
}
