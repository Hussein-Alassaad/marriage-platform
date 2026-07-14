import { cn } from '@/utils/cn';

interface AuroraBackgroundProps {
  className?: string;
}

/**
 * Two large, pre-blurred radial gradients drifting slowly behind hero content
 * (§3 AuroraBackground): emerald + a whisper of gold. No CSS filter (the
 * gradients fade to transparent, so they read as soft light, not hard discs).
 * Decorative and non-interactive; the drift keyframes stop under reduced motion.
 */
export function AuroraBackground({ className }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div
        className="absolute start-[-10%] -top-[15%] h-[55vw] w-[55vw] [animation:aurora-a_18s_ease-in-out_infinite] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(16,185,129,0.20), transparent 70%)',
        }}
      />
      <div
        className="absolute end-[-8%] -bottom-[20%] h-[45vw] w-[45vw] [animation:aurora-b_26s_ease-in-out_infinite] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(201,162,39,0.10), transparent 70%)',
        }}
      />
    </div>
  );
}
