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
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-glow ring-1 ring-brand-900/10">
        <Heart className="h-[1.15rem] w-[1.15rem]" aria-hidden />
      </span>
      {!compact ? (
        <span className="text-[0.95rem] font-semibold tracking-tight text-ink">
          {t('common.appName')}
        </span>
      ) : null}
    </div>
  );
}
