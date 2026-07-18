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
import { useProfile } from '@/hooks/useProfile';
import { useConnections } from '@/hooks/useMatch';

interface Stage {
  key: string;
  icon: LucideIcon;
  /** Where the "next step" button sends the member while this stage is current. */
  route: string;
}

/**
 * The journey, in the order the platform actually asks for it: make an account, build
 * your profile, verify your identity (the gate before matching, Decision #5), then match,
 * talk, involve family, and marry.
 */
const STAGES: Stage[] = [
  { key: 'account', icon: UserPlus, route: ROUTES.home },
  { key: 'profile', icon: UserRound, route: ROUTES.onboarding },
  { key: 'verify', icon: ShieldCheck, route: ROUTES.verifyIdentity },
  { key: 'matching', icon: Heart, route: ROUTES.match },
  { key: 'introduction', icon: MessagesSquare, route: ROUTES.messages },
  { key: 'family', icon: Users, route: ROUTES.messages },
  { key: 'married', icon: Gem, route: ROUTES.messages },
];

const INDEX = {
  account: 0,
  profile: 1,
  verify: 2,
  matching: 3,
  introduction: 4,
  family: 5,
  married: 6,
} as const;

/** A profile counts as "done" for the journey at this completeness — one skipped optional
 *  field should not hold the whole journey back. */
const PROFILE_DONE_AT = 80;

/**
 * The member's real position, derived from their profile and their connections — not a
 * hardcoded step. The furthest of "where their setup has reached" and "where their most
 * advanced connection has reached" wins, so an active chat shows as further along than
 * setup, and setup still shows while there is no connection yet.
 */
function currentIndex(verified: boolean, profileComplete: boolean, matchStages: string[]): number {
  let fromMatch = 0;
  if (matchStages.includes('married')) fromMatch = INDEX.married;
  else if (matchStages.includes('family')) fromMatch = INDEX.family;
  else if (matchStages.some((s) => s === 'introduction' || s === 'serious_communication')) {
    fromMatch = INDEX.introduction;
  } else if (matchStages.length) fromMatch = INDEX.matching; // an interest is in flight

  let fromSetup: number;
  if (!profileComplete) fromSetup = INDEX.profile;
  else if (!verified) fromSetup = INDEX.verify;
  else fromSetup = INDEX.matching; // profile done + verified → ready to match

  return Math.min(Math.max(fromSetup, fromMatch), STAGES.length - 1);
}

// Horizontal centre of each node as a percentage of the track width.
const cellWidth = 100 / STAGES.length;
const nodeCenter = (index: number) => (index + 0.5) * cellWidth;

// Timing: the path finishes tracing, then the active node beats once.
const TRACE_DURATION = 0.8;

function StageNode({
  stage,
  index,
  current: currentIdx,
}: {
  stage: Stage;
  index: number;
  current: number;
}) {
  const { t } = useTranslation();
  const done = index < currentIdx;
  const current = index === currentIdx;
  const Icon = stage.icon;

  return (
    <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <motion.span
        className={cn(
          // Shrinks on phones so all seven fit without scrolling; full size from sm up.
          'relative flex h-9 w-9 items-center justify-center rounded-full border sm:h-11 sm:w-11',
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
          <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
        ) : (
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
        )}
      </motion.span>
      {/* Constrained to the cell and allowed to wrap, so a long word like
          "Introduction" stacks inside its own column instead of running into the
          next label. */}
      <span
        className={cn(
          'w-full px-0.5 text-[10px] leading-tight font-medium break-words sm:text-xs',
          current ? 'text-ink' : 'text-muted',
        )}
      >
        {t(`page.home.journey.stages.${stage.key}`)}
      </span>
    </div>
  );
}

export function JourneyCard() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: connections } = useConnections();

  const verified = profile?.verification_status === 'verified';
  const profileComplete = (profile?.profile_completion ?? 0) >= PROFILE_DONE_AT;
  const matchStages = (connections?.matches ?? [])
    .filter((m) => m.stage !== 'terminated')
    .map((m) => m.stage);

  const current = currentIndex(verified, profileComplete, matchStages);
  const currentStage = STAGES[current];
  const complete = current === STAGES.length - 1; // married — the journey's end

  const railStart = nodeCenter(0);
  const railEnd = nodeCenter(STAGES.length - 1);
  const traceEnd = nodeCenter(current);

  const NextIcon = currentStage.icon;

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
          {t('page.home.journey.stepOf', { current: current + 1, total: STAGES.length })}
        </span>
      </div>

      {/* Stepper. The connecting line traces itself from the start to the current
          step (transform-only scaleX) — the journey literally advancing. */}
      <div className="relative mt-7">
        {/* Rail sits at each node's vertical center — 18px for the h-9 mobile node,
            22px for the h-11 node from sm up. */}
        <div
          aria-hidden
          className="bg-line-strong absolute top-[18px] z-0 h-0.5 rounded sm:top-[22px]"
          style={{ insetInlineStart: `${railStart}%`, insetInlineEnd: `${100 - railEnd}%` }}
        />
        <motion.div
          aria-hidden
          className="bg-brand-500 absolute top-[18px] z-0 h-0.5 origin-left rounded sm:top-[22px] rtl:origin-right"
          style={{ insetInlineStart: `${railStart}%`, width: `${traceEnd - railStart}%` }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: TRACE_DURATION, ease: EASE_OUT_EXPO }}
        />

        {/* No horizontal scroll: the steps shrink to fit the width instead of spilling
            over and showing a scroll arrow with a half-cut label. */}
        <ol className="relative flex items-start gap-0.5 sm:gap-1">
          {STAGES.map((stage, index) => (
            <li key={stage.key} className="flex min-w-0 flex-1">
              <StageNode stage={stage} index={index} current={current} />
            </li>
          ))}
        </ol>
      </div>

      {/* Next-step callout — reflects the step the member is actually on. Hidden once the
          journey is complete, since there is no next step to point at. */}
      {!complete ? (
        <div className="border-brand-100 bg-brand-50/50 mt-7 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="bg-surface text-brand-600 ring-brand-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
              <NextIcon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-brand-700 text-xs font-semibold tracking-wider uppercase">
                {t('page.home.journey.next')}
              </p>
              <p className="text-ink-soft mt-0.5 text-sm leading-relaxed">
                {t(`page.home.journey.step.${currentStage.key}.detail`)}
              </p>
            </div>
          </div>
          <Link to={currentStage.route} className="shrink-0">
            <Button>{t(`page.home.journey.step.${currentStage.key}.cta`)}</Button>
          </Link>
        </div>
      ) : (
        <div className="border-brand-100 bg-brand-50/50 mt-7 flex items-center gap-3 rounded-2xl border p-4 sm:p-5">
          <span className="bg-surface text-brand-600 ring-brand-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset">
            <Gem className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-ink-soft text-sm leading-relaxed">
            {t('page.home.journey.step.married.detail')}
          </p>
        </div>
      )}
    </section>
  );
}
