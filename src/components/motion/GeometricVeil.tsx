import { useId } from 'react';

import { cn } from '@/utils/cn';

interface GeometricVeilProps {
  className?: string;
  /** Tile size in px. */
  tile?: number;
}

/**
 * A faint tiled geometric lattice (§3 GeometricVeil): an 8-point star motif
 * repeated across the surface at very low opacity, masked to fade toward the
 * edges so it never competes with content. Purely decorative. Uses currentColor
 * via `text-*` on the wrapper; opacity handles theme (a touch stronger on light).
 */
export function GeometricVeil({ className, tile = 96 }: GeometricVeilProps) {
  const patternId = useId();
  return (
    <div
      aria-hidden
      className={cn(
        'text-ink pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.03]',
        className,
      )}
      style={{
        maskImage: 'radial-gradient(120% 120% at 50% 30%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(120% 120% at 50% 30%, black 30%, transparent 75%)',
      }}
    >
      <svg width="100%" height="100%">
        <defs>
          <pattern id={patternId} width={tile} height={tile} patternUnits="userSpaceOnUse">
            <g stroke="currentColor" strokeWidth="1" fill="none">
              <rect x={tile * 0.31} y={tile * 0.31} width={tile * 0.375} height={tile * 0.375} />
              <rect
                x={tile * 0.31}
                y={tile * 0.31}
                width={tile * 0.375}
                height={tile * 0.375}
                transform={`rotate(45 ${tile / 2} ${tile / 2})`}
              />
              <circle cx={tile / 2} cy={tile / 2} r={tile * 0.0625} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
