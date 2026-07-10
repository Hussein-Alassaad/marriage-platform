import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from 'framer-motion';

import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthMascot } from '@/components/AuthMascot';
import { PageTransition } from '@/components/motion/PageTransition';
import { AuroraBackground } from '@/components/motion/AuroraBackground';
import { GeometricVeil } from '@/components/motion/GeometricVeil';
import { AmbientParticles } from '@/components/motion/AmbientParticles';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { EASE_EXPO } from '@/lib/motion';

/**
 * Cinematic, glass-forward auth frame. A character leans in and physically
 * pushes the card (desktop): a shared push phase both animates the character and
 * recoils the glass card via an under-damped spring. Layered background —
 * mesh + aurora + geometric veil + ambient motes — builds depth without WebGL,
 * so it stays light on low-end devices. Mobile gets a dedicated, calmer layout.
 * Content/routing/i18n are untouched; everything here is presentational.
 */
export function AuthLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Shared push phase (0→1→0) and the card's recoil spring.
  const pushPhase = useMotionValue(0);
  const cardX = useSpring(0, { stiffness: 210, damping: 12, mass: 0.7 });

  useEffect(() => {
    if (reduced || !isDesktop) {
      cardX.set(0);
      return;
    }
    const controls = animate(pushPhase, [0, 1, 0], {
      duration: 3.4,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatDelay: 0.9,
    });
    return () => controls.stop();
  }, [reduced, isDesktop, pushPhase, cardX]);

  // Recoil the card the instant the hand makes contact, then let it settle.
  useMotionValueEvent(pushPhase, 'change', (v) => {
    cardX.set(v > 0.5 ? 9 : 0);
  });

  return (
    <div className="app-backdrop relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Background depth layers (cheapest → richest). */}
      <div aria-hidden className="auth-mesh pointer-events-none absolute inset-0" />
      <AuroraBackground />
      <GeometricVeil />
      <AmbientParticles />

      <div className="relative w-full max-w-md">
        {/* Mobile: a smaller character greets from the very top (clear of the
            wide, centred motto), then the branding, then a full-width card. */}
        {!isDesktop ? (
          <AuthMascot className="-mb-2 flex h-28 justify-center [&_svg]:h-28 [&_svg]:w-auto" />
        ) : null}

        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted">{t('common.motto')}</p>
        </div>

        {/* Card + desktop character share one anchor so they stay aligned. */}
        <div className="relative">
          {isDesktop ? (
            <AuthMascot
              pushPhase={pushPhase}
              className="absolute top-1/2 z-10 -translate-y-1/2 ltr:end-full ltr:-me-4 rtl:start-full rtl:-ms-4 rtl:-scale-x-100"
            />
          ) : null}

          <motion.div
            style={{ x: cardX }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.08 }}
            className="auth-card-glass relative z-10 overflow-hidden rounded-card border border-line [box-shadow:var(--shadow-elevated),var(--inner-hi)]"
          >
            <PageTransition pathname={location.pathname}>
              <Outlet />
            </PageTransition>
          </motion.div>
        </div>

        <div className="relative z-10 mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
