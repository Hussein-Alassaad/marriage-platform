import { cn } from '@/utils/cn';

interface AuroraBackgroundProps {
  className?: string;
}

/**
 * Two large, soft radial gradients behind hero content: emerald + a whisper of gold. They
 * fade to transparent, so they read as pooled light rather than hard discs.
 *
 * STATIC. These used to drift on 18s/26s infinite keyframes — a perpetual background
 * animation running the whole time the page was open, which is exactly the kind of
 * per-frame work that made the app feel heavy. The gradients look all but identical
 * standing still, so they now do.
 */
export function AuroraBackground({ className }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div
        className="absolute start-[-10%] -top-[15%] h-[55vw] w-[55vw] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(16,185,129,0.20), transparent 70%)',
        }}
      />
      <div
        className="absolute end-[-8%] -bottom-[20%] h-[45vw] w-[45vw] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(201,162,39,0.10), transparent 70%)',
        }}
      />
    </div>
  );
}
