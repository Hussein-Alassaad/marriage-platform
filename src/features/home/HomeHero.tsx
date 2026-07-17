import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { GeometricVeil } from '@/components/motion/GeometricVeil';
import { ROUTES } from '@/app/routes';
import { isSupabaseConfigured } from '@/services/backendService';
import { EASE_OUT_EXPO, revealVariants } from '@/lib/motion';

function BackendStatus() {
  const { t } = useTranslation();
  const ok = isSupabaseConfigured();
  return (
    <Badge variant={ok ? 'success' : 'neutral'} withDot>
      {ok ? t('common.backendConfigured') : t('common.backendNotConfigured')}
    </Badge>
  );
}

/**
 * The page's signature move: the headline reveals word-group by word-group with
 * a mask wipe (each word rises from behind an overflow-hidden clip). Word gaps
 * use a logical margin because trailing whitespace collapses inside inline-block.
 */
function HeroHeadline({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <motion.h1
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      className="text-ink mt-5 text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]"
    >
      {words.map((word, i) => (
        <span
          key={i}
          className={`inline-block overflow-hidden pb-[0.08em] align-bottom${
            i < words.length - 1 ? 'me-[0.28em]' : ''
          }`}
        >
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: '115%' },
              visible: { y: 0, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </motion.h1>
  );
}

export function HomeHero() {
  const { t } = useTranslation();

  // The hero used to run pointer parallax — the background and headline drifting on
  // opposite axes, re-rendered on every mouse move. It read well but was steady per-frame
  // work whenever the cursor was over the card. Removed for the same reason the login
  // scene went static: a calmer, lighter home screen. The one-shot entrance stays.
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
      className="rounded-card border-line bg-surface relative overflow-hidden border [box-shadow:var(--shadow-card),var(--inner-hi)]"
    >
      {/* Static hero wash + faint geometric veil. */}
      <div aria-hidden className="hero-gradient pointer-events-none absolute -inset-6" />
      <GeometricVeil />

      <div className="relative px-6 py-10 sm:px-12 sm:py-14">
        <div className="max-w-2xl">
          <motion.span
            variants={revealVariants}
            className="bg-brand-wash text-brand-700 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-[color:var(--color-border-accent)] backdrop-blur ring-inset"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('page.home.eyebrow')}
          </motion.span>

          <HeroHeadline text={t('page.home.greeting')} />

          <motion.p
            variants={revealVariants}
            className="text-ink-soft mt-3 max-w-xl text-base leading-relaxed sm:text-lg"
          >
            {t('page.home.subtitle')}
          </motion.p>

          <motion.div variants={revealVariants} className="mt-7 flex flex-wrap items-center gap-3">
            <Link to={ROUTES.match}>
              <Button size="lg" magnetic>
                {t('page.home.ctaPrimary')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
            <Link to={ROUTES.profile}>
              <Button size="lg" variant="outline">
                {t('page.home.ctaSecondary')}
              </Button>
            </Link>
          </motion.div>

          <motion.div
            variants={revealVariants}
            className="text-muted mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="text-brand-600 h-[1.05rem] w-[1.05rem]" aria-hidden />
              {t('page.home.trustVerified')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="text-brand-600 h-[1.05rem] w-[1.05rem]" aria-hidden />
              {t('page.home.trustPrivate')}
            </span>
            <BackendStatus />
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
