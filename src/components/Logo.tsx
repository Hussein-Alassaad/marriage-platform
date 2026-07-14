import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

export interface LogoProps {
  compact?: boolean;
  className?: string;
}

export function Logo({ compact = false, className }: LogoProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="from-brand-500 to-brand-800 shadow-glow ring-brand-900/10 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white ring-1">
        <Heart className="h-[1.15rem] w-[1.15rem]" aria-hidden />
      </span>
      {!compact ? (
        <span className="text-ink text-[0.95rem] font-semibold tracking-tight">
          {t('common.appName')}
        </span>
      ) : null}
    </div>
  );
}
