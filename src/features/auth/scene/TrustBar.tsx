import { BadgeCheck, Gem, HeartHandshake, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';

interface Item {
  icon: LucideIcon;
  title: string;
  caption: string;
}

/**
 * Bottom trust strip — the platform's promises. Glass, evenly spaced with thin
 * dividers; staggers up on load. Copy is bilingual (auth.trust.*).
 */
export function TrustBar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const items: Item[] = [
    {
      icon: ShieldCheck,
      title: t('auth.trust.privacyTitle'),
      caption: t('auth.trust.privacyCaption'),
    },
    {
      icon: BadgeCheck,
      title: t('auth.trust.verifiedTitle'),
      caption: t('auth.trust.verifiedCaption'),
    },
    { icon: Gem, title: t('auth.trust.valuesTitle'), caption: t('auth.trust.valuesCaption') },
    {
      icon: HeartHandshake,
      title: t('auth.trust.marriageTitle'),
      caption: t('auth.trust.marriageCaption'),
    },
  ];

  return (
    <div
      className={cn(
        'glass border-line grid grid-cols-2 gap-px overflow-hidden rounded-2xl border md:grid-cols-4',
        className,
      )}
    >
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.div
            key={it.title}
            className="bg-bg-2/30 flex items-start gap-3 p-4"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.7 + i * 0.08 }}
          >
            <span className="bg-brand-wash text-brand-400 mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-[color:var(--color-border-accent)] ring-inset">
              <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-ink text-sm font-semibold">{it.title}</p>
              <p className="text-muted mt-0.5 text-xs leading-snug">{it.caption}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
