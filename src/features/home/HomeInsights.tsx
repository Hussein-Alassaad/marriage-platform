import { Link } from 'react-router-dom';
import { ArrowRight, Lock, MessageCircle, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { HoverCard } from '@/components/motion/HoverCard';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { EASE_EXPO } from '@/lib/motion';
import { CardDescription, CardTitle } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';

function InsightLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-brand-700 hover:text-brand-800 mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition duration-150 hover:gap-2 active:scale-95"
    >
      {label}
      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

function MatchPreviewCard() {
  const { t } = useTranslation();
  const avatarTints = [
    'from-brand-100 to-brand-200',
    'from-brand-200 to-brand-300',
    'from-brand-100 to-brand-300',
  ];
  return (
    <HoverCard className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <Badge variant="brand">{t('page.home.match.badge')}</Badge>
        <span className="text-faint inline-flex items-center gap-1 text-xs">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {t('page.home.match.locked')}
        </span>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex -space-x-3 rtl:space-x-reverse">
          {avatarTints.map((tint, i) => (
            <span
              key={i}
              className={cn(
                'ring-surface h-11 w-11 rounded-full bg-gradient-to-br ring-2 blur-[2px]',
                tint,
              )}
              aria-hidden
            />
          ))}
        </div>
        <span className="bg-brand-600 text-on-brand flex h-6 w-6 items-center justify-center rounded-full">
          <Lock className="h-3 w-3" aria-hidden />
        </span>
      </div>
      <CardTitle className="mt-5">{t('page.home.match.title')}</CardTitle>
      <CardDescription>{t('page.home.match.body')}</CardDescription>
      <InsightLink to={ROUTES.match} label={t('nav.match')} />
    </HoverCard>
  );
}

function AssistantCard() {
  const { t } = useTranslation();
  return (
    <HoverCard className="flex h-full flex-col">
      <span className="bg-brand-50 text-brand-600 ring-brand-100 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset">
        <MessageCircle className="h-[1.35rem] w-[1.35rem]" aria-hidden />
      </span>
      <CardTitle className="mt-5">{t('page.home.assistant.title')}</CardTitle>
      <CardDescription>{t('page.home.assistant.body')}</CardDescription>
      <InsightLink to={ROUTES.assistant} label={t('page.home.assistant.cta')} />
    </HoverCard>
  );
}

function FinanceCard() {
  const { t } = useTranslation();
  return (
    <HoverCard className="flex h-full flex-col">
      <span className="bg-brand-50 text-brand-600 ring-brand-100 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset">
        <Wallet className="h-[1.35rem] w-[1.35rem]" aria-hidden />
      </span>
      <CardTitle className="mt-5">{t('page.home.finance.title')}</CardTitle>
      <CardDescription>{t('page.home.finance.body')}</CardDescription>
      <div className="bg-bg-4 mt-5 h-2 w-full overflow-hidden rounded-full" aria-hidden>
        <motion.div
          className="h-full origin-left rounded-full [background:linear-gradient(90deg,var(--color-brand-500),var(--color-brand-300))] rtl:origin-right"
          style={{ width: '8%' }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.9, ease: EASE_EXPO }}
        />
      </div>
      <InsightLink to={ROUTES.finance} label={t('page.home.finance.cta')} />
    </HoverCard>
  );
}

export function HomeInsights() {
  return (
    <Stagger className="grid gap-4 md:grid-cols-3">
      <StaggerItem className="h-full">
        <MatchPreviewCard />
      </StaggerItem>
      <StaggerItem className="h-full">
        <AssistantCard />
      </StaggerItem>
      <StaggerItem className="h-full">
        <FinanceCard />
      </StaggerItem>
    </Stagger>
  );
}
