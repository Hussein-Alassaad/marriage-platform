import { type HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

/** Loading placeholder — used instead of blank white screens (PRD requirement). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shimmer rounded-md', className)} {...props} />;
}
