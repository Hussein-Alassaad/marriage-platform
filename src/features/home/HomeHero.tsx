import { type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { AuroraBackground } from '@/components/motion/AuroraBackground';
import { GeometricVeil } from '@/components/motion/GeometricVeil';
import { ROUTES } from '@/app/routes';
import { isSupabaseConfigured } from '@/services/backendService';
import { EASE_OUT_EXPO, revealVariants } from '@/lib/motion';
import { usePointerFine } from '@/hooks/usePointerFine';

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
  const pointerFine = usePointerFine();
  const reduced = useReducedMotion();
  const parallaxOn = pointerFine && !reduced;

  // Pointer parallax: headline and background drift on opposite axes for depth.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 150, damping: 20, mass: 0.6 };
  const fgX = useSpring(px, spring);
  const fgY = useSpring(py, spring);
  const bgX = useTransform(fgX, (v) => v * -0.8);
  const bgY = useTransform(fgY, (v) => v * -0.8);

  const handleMove = (event: PointerEvent<HTMLElement>) => {
    if (!parallaxOn) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const ny = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    px.set(Math.max(-1, Math.min(1, nx)) * 11);
    py.set(Math.max(-1, Math.min(1, ny)) * 11);
  };

  const handleLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
      onPointerMove={parallaxOn ? handleMove : undefined}
      onPointerLeave={parallaxOn ? handleLeave : undefined}
      className="rounded-card border-line bg-surface relative overflow-hidden border [box-shadow:var(--shadow-card),var(--inner-hi)]"
    >
      {/* Layer order (back→front): surface → hero wash (parallax) → aurora drift
          → geometric veil → content. */}
      <motion.div
        aria-hidden
        style={{ x: bgX, y: bgY }}
        className="hero-gradient pointer-events-none absolute -inset-6"
      />
      <AuroraBackground />
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

          <motion.div style={{ x: fgX, y: fgY }}>
            <HeroHeadline text={t('page.home.greeting')} />
          </motion.div>

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
