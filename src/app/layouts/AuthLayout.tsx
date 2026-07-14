import { type PointerEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/motion/PageTransition';
import { AuroraBackground } from '@/components/motion/AuroraBackground';
import { GeometricVeil } from '@/components/motion/GeometricVeil';
import { AmbientParticles } from '@/components/motion/AmbientParticles';
import { Starfield } from '@/features/auth/scene/Starfield';
import { ArchedWindow } from '@/features/auth/scene/ArchedWindow';
import { Lantern } from '@/features/auth/scene/Lantern';
import { CalligraphyVerse } from '@/features/auth/scene/CalligraphyVerse';
import { TrustBar } from '@/features/auth/scene/TrustBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePointerFine } from '@/hooks/usePointerFine';
import { EASE_EXPO } from '@/lib/motion';

/**
 * Auth scene — luxury Islamic-architecture, no characters. A centered glass card
 * (the focal point) framed by a glowing pointed arch, flanked by twin lanterns,
 * with an Amiri calligraphy verse, geometric lattice, drifting aurora + mesh and
 * slow light particles. All CSS/Framer (no WebGL) for 60fps on average phones.
 * Content/routing/i18n/validation untouched.
 */
export function AuthLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const pointerFine = usePointerFine();
  const parallax = isDesktop && pointerFine && !reduced;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 50, damping: 18, mass: 0.6 });
  const archX = useTransform(sx, [-1, 1], [-10, 10]);
  const archY = useTransform(sy, [-1, 1], [-10, 10]);
  const lanternX = useTransform(sx, [-1, 1], [-14, 14]);
  const lanternY = useTransform(sy, [-1, 1], [-14, 14]);
  const verseX = useTransform(sx, [-1, 1], [7, -7]);
  const cardX = useTransform(sx, [-1, 1], [-5, 5]);
  const cardY = useTransform(sy, [-1, 1], [-5, 5]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!parallax) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="app-backdrop relative flex min-h-screen flex-col overflow-hidden"
    >
      {/* Background depth (back → front) */}
      <div aria-hidden className="auth-mesh pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 44rem at 12% 76%, rgba(201,162,39,0.14), transparent 60%), radial-gradient(52rem 40rem at 90% 20%, rgba(227,197,103,0.09), transparent 62%)',
        }}
      />
      <Starfield />
      <motion.div style={parallax ? { x: verseX } : undefined} className="absolute inset-0 z-0">
        <CalligraphyVerse />
      </motion.div>
      <GeometricVeil />
      <AuroraBackground />
      <AmbientParticles count={12} />

      {/* Central architectural arch, framing the card with warm light. */}
      <motion.div
        aria-hidden
        style={parallax ? { x: archX, y: archY } : undefined}
        className="absolute top-1/2 left-1/2 z-0 hidden h-[94vh] w-[64vh] -translate-x-1/2 -translate-y-1/2 opacity-80 lg:block"
      >
        <ArchedWindow className="inset-0 h-full w-full" />
      </motion.div>

      {/* Twin lanterns */}
      <motion.div
        style={parallax ? { x: lanternX, y: lanternY } : undefined}
        className="absolute top-0 z-0 ltr:left-[17%] rtl:right-[17%]"
      >
        <Lantern />
      </motion.div>
      <motion.div
        style={parallax ? { x: lanternX, y: lanternY } : undefined}
        className="absolute top-0 z-0 hidden scale-90 opacity-90 lg:block ltr:right-[17%] rtl:left-[17%]"
      >
        <Lantern />
      </motion.div>

      {/* Trust pill (top-start) */}
      <div className="glass border-line absolute top-4 z-30 hidden items-center gap-2 rounded-full border px-3.5 py-2 sm:flex ltr:left-4 rtl:right-4">
        <Users className="text-gold-400 h-4 w-4" aria-hidden />
        <span className="text-ink-soft text-xs font-medium">{t('auth.trustedBy')}</span>
      </div>

      {/* Top-end controls */}
      <div className="absolute top-4 z-30 flex items-center gap-2 ltr:right-4 rtl:left-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Card — the focal point */}
      <div className="relative z-20 flex flex-1 items-center justify-center px-4 pt-16 pb-6 sm:pt-12">
        <motion.div
          style={parallax ? { x: cardX, y: cardY } : undefined}
          className="relative w-[min(560px,92vw)]"
        >
          {/* Soft gold + emerald glow pooled behind the card. */}
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-[64px] opacity-70 blur-3xl"
            style={{
              background:
                'radial-gradient(closest-side, rgba(16,185,129,0.22), transparent 70%), radial-gradient(closest-side at 70% 30%, rgba(201,162,39,0.14), transparent 72%)',
            }}
          />
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_EXPO, delay: 0.5 }}
            className="auth-card-glass border-line relative overflow-hidden rounded-[40px_40px_24px_24px] border [box-shadow:0_24px_80px_rgba(0,0,0,0.5),var(--inner-hi)]"
          >
            {/* Gold hairline along the arched top. */}
            <span
              aria-hidden
              className="via-gold-400/50 pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent"
            />
            <PageTransition pathname={location.pathname}>
              <Outlet />
            </PageTransition>
          </motion.div>
        </motion.div>
      </div>

      {/* Trust bar */}
      <div className="relative z-20 px-4 pb-6">
        <TrustBar className="mx-auto w-full max-w-4xl" />
      </div>
    </div>
  );
}
