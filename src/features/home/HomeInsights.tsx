import { Link } from 'react-router-dom';
import { ArrowRight, Lock, MessageCircle, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { HoverCard } from '@/components/motion/HoverCard';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { CardDescription, CardTitle } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';

function InsightLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition duration-150 hover:gap-2 hover:text-brand-800 active:scale-95"
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
        <span className="inline-flex items-center gap-1 text-xs text-faint">
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
                'h-11 w-11 rounded-full bg-gradient-to-br ring-2 ring-surface blur-[2px]',
                tint,
              )}
              aria-hidden
            />
          ))}
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-white">
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
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
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
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
        <Wallet className="h-[1.35rem] w-[1.35rem]" aria-hidden />
      </span>
      <CardTitle className="mt-5">{t('page.home.finance.title')}</CardTitle>
      <CardDescription>{t('page.home.finance.body')}</CardDescription>
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full w-[8%] rounded-full bg-brand-400" />
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
