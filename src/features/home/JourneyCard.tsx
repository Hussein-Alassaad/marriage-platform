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
          'relative flex h-11 w-11 items-center justify-center rounded-full border',
          done && 'border-brand-400 bg-brand-wash text-brand-600',
          current && 'border-brand-400 bg-bg-3 text-brand-600 border-2',
          !done && !current && 'border-line-strong bg-surface text-faint',
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
        {/* Breathing halo on the current step. */}
        {current ? (
          <span
            aria-hidden
            className="border-brand-400 absolute inset-0 [animation:breathe_2.4s_ease-in-out_infinite] rounded-full border-2"
          />
        ) : null}
        {done ? (
          <Check className="h-5 w-5" aria-hidden />
        ) : (
          <Icon className="h-5 w-5" aria-hidden />
        )}
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
    <section className="rounded-card border-line bg-surface border p-6 [box-shadow:var(--shadow-card),var(--inner-hi)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-brand-700 text-xs font-semibold tracking-wider uppercase">
            {t('page.home.journey.eyebrow')}
          </p>
          <h2 className="text-ink mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {t('page.home.journey.title')}
          </h2>
          <p className="text-muted mt-1.5 max-w-xl text-sm leading-relaxed">
            {t('page.home.journey.subtitle')}
          </p>
        </div>
        <span className="bg-gold-wash text-gold-400 ring-gold-500/30 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset">
          {t('page.home.journey.stepOf', { current: CURRENT_INDEX + 1, total: STAGES.length })}
        </span>
      </div>

      {/* Stepper. The connecting line traces itself from the start to the current
          step (transform-only scaleX) — the journey literally advancing. */}
      <div className="relative mt-7">
        <div
          aria-hidden
          className="bg-line-strong absolute top-[21px] z-0 h-0.5 rounded"
          style={{ insetInlineStart: `${railStart}%`, insetInlineEnd: `${100 - railEnd}%` }}
        />
        <motion.div
          aria-hidden
          className="bg-brand-500 absolute top-[21px] z-0 h-0.5 origin-left rounded rtl:origin-right"
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
      <div className="border-brand-100 bg-brand-50/50 mt-7 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="bg-surface text-brand-600 ring-brand-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-brand-700 text-xs font-semibold tracking-wider uppercase">
              {t('page.home.journey.next')}
            </p>
            <p className="text-ink-soft mt-0.5 text-sm leading-relaxed">
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
