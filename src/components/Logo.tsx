import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

export interface LogoProps {
  compact?: boolean;
  className?: string;
}

/**
 * Twin Arches: two nested pointed-arch strokes (echoing the auth scene's
 * <ArchedWindow>) — a wider gold arch behind, a narrower white one in front —
 * read as two paths folding into one household, the actual concept behind a
 * marriage platform. Not a heart: a heart reads as dating-app iconography,
 * which this platform explicitly is not (see CLAUDE.md).
 */
export function Logo({ compact = false, className }: LogoProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="from-brand-500 to-brand-800 shadow-glow ring-brand-900/10 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1">
        <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" aria-hidden>
          <path
            d="M3 19V11.5Q12 3.3 21 11.5V19"
            fill="none"
            stroke="var(--color-gold-400)"
            strokeOpacity="0.7"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M7 19V10.5Q12 2.7 17 10.5V19"
            fill="none"
            stroke="white"
            strokeOpacity="0.95"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact ? (
        <span className="text-ink text-[0.95rem] font-semibold tracking-tight">
          {t('common.appName')}
        </span>
      ) : null}
    </div>
  );
}
