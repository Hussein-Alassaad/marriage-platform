import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

import { cn } from '@/utils/cn';
import { springMicro } from '@/lib/motion';

export type HoverCardProps = HTMLMotionProps<'div'>;

/**
 * A clickable card/tile with hover depth: springs up translateY(-4px) on hover,
 * shadow softens larger and the border brightens (150ms), springs back on leave.
 * Transform-only lift keeps it at 60fps; MotionConfig disables it for
 * reduced-motion users.
 */
export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(function HoverCard(
  { className, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        'rounded-card border-line bg-surface shadow-card border p-6',
        'transition-[box-shadow,border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'hover:border-line-strong hover:shadow-elevated',
        className,
      )}
      whileHover={{ y: -4 }}
      whileTap={{ y: -4 }}
      transition={springMicro}
      {...props}
    />
  );
});
