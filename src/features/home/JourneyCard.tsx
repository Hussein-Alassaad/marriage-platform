import { Link } from 'react-router-dom';
import {
  Check,
  Gem,
  Heart,
  MessagesSquare,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { Button } from '@/components/Button';
import { cn } from '@/utils/cn';
import { EASE_OUT_EXPO } from '@/lib/motion';
import { ROUTES } from '@/app/routes';

interface Stage {
  key: string;
  icon: LucideIcon;
}

const STAGES: Stage[] = [
  { key: 'account', icon: UserPlus },
  { key: 'verify', icon: ShieldCheck },
  { key: 'profile', icon: UserRound },
  { key: 'matching', icon: Heart },
  { key: 'introduction', icon: MessagesSquare },
  { key: 'family', icon: Users },
  { key: 'married', icon: Gem },
];

// A freshly created account: step 1 done, identity verification is next.
const CURRENT_INDEX = 1;

// Horizontal centre of each node as a percentage of the track width.
const cellWidth = 100 / STAGES.length;
const nodeCenter = (index: number) => (index + 0.5) * cellWidth;

// Timing: the path finishes tracing, then the active node beats once.
const TRACE_DURATION = 0.8;

function StageNode({ stage, index }: { stage: Stage; index: number }) {
  const { t } = useTranslation();
  const done = index < CURRENT_INDEX;
  const current = index === CURRENT_INDEX;
  const Icon = stage.icon;

  return (
    <div className="relative z-10 flex min-w-[4.25rem] flex-1 flex-col items-center gap-2 text-center">
      <motion.span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border',
          done && 'border-transparent bg-brand-600 text-white shadow-glow',
          current && 'border-brand-500 bg-surface text-brand-700 ring-4 ring-brand-100',
          !done && !current && 'border-line bg-surface text-faint',
        )}
        // Signature "heartbeat": the active node pulses once, right after the
        // path finishes tracing to it.
        {...(current
          ? {
              initial: { scale: 1 },
              whileInView: { scale: [1, 1.09, 1] },
              viewport: { once: true, amount: 0.6 },
              transition: { delay: TRACE_DURATION + 0.1, duration: 0.6, ease: EASE_OUT_EXPO },
            }
          : {})}
      >
        {done ? <Check className="h-5 w-5" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
      </motion.span>
      <span className={cn('text-xs font-medium', current ? 'text-ink' : 'text-muted')}>
        {t(`page.home.journey.stages.${stage.key}`)}
      </span>
    </div>
  );
}

export function JourneyCard() {
  const { t } = useTranslation();
  const railStart = nodeCenter(0);
  const railEnd = nodeCenter(STAGES.length - 1);
  const traceEnd = nodeCenter(CURRENT_INDEX);

  return (
    <section className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            {t('page.home.journey.eyebrow')}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {t('page.home.journey.title')}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
            {t('page.home.journey.subtitle')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
          {t('page.home.journey.stepOf', { current: CURRENT_INDEX + 1, total: STAGES.length })}
        </span>
      </div>

      {/* Stepper. The connecting line traces itself from the start to the current
          step (transform-only scaleX) — the journey literally advancing. */}
      <div className="relative mt-7">
        <div
          aria-hidden
          className="absolute top-[19px] z-0 h-0.5 rounded bg-line"
          style={{ insetInlineStart: `${railStart}%`, insetInlineEnd: `${100 - railEnd}%` }}
        />
        <motion.div
          aria-hidden
          className="absolute top-[19px] z-0 h-0.5 origin-left rounded bg-brand-500 rtl:origin-right"
          style={{ insetInlineStart: `${railStart}%`, width: `${traceEnd - railStart}%` }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: TRACE_DURATION, ease: EASE_OUT_EXPO }}
        />

        <ol className="relative flex items-start gap-1 overflow-x-auto pb-1">
          {STAGES.map((stage, index) => (
            <li key={stage.key} className="flex flex-1">
              <StageNode stage={stage} index={index} />
            </li>
          ))}
        </ol>
      </div>

      {/* Next-step callout. */}
      <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-600 ring-1 ring-inset ring-brand-100">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              {t('page.home.journey.next')}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
              {t('page.home.journey.nextDetail')}
            </p>
          </div>
        </div>
        <Link to={ROUTES.profile} className="shrink-0">
          <Button>{t('page.home.journey.cta')}</Button>
        </Link>
      </div>
    </section>
  );
}
