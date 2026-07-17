import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/motion/PageTransition';
import { ArchedWindow } from '@/features/auth/scene/ArchedWindow';
import { Lantern } from '@/features/auth/scene/Lantern';
import { CalligraphyVerse } from '@/features/auth/scene/CalligraphyVerse';
import { TrustBar } from '@/features/auth/scene/TrustBar';
import { EASE_EXPO } from '@/lib/motion';

/**
 * Auth scene — luxury Islamic-architecture, no characters. A centered glass card
 * (the focal point) framed by a glowing pointed arch, flanked by twin lanterns,
 * over a warm static gradient.
 *
 * Deliberately STATIC. The earlier version layered a starfield, drifting aurora,
 * floating particles and a geometric veil, and tracked the pointer to parallax eight
 * separate layers on every mouse move — beautiful, and far too much work per frame on
 * an average machine, which showed as lag on the login screen. The look is kept; the
 * per-frame animation is gone. Only the card keeps a single one-shot entrance.
 */
export function AuthLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <div className="app-backdrop relative flex min-h-screen flex-col overflow-hidden">
      {/* Background depth (back → front) — all static. */}
      <div aria-hidden className="auth-mesh pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 44rem at 12% 76%, rgba(201,162,39,0.14), transparent 60%), radial-gradient(52rem 40rem at 90% 20%, rgba(227,197,103,0.09), transparent 62%)',
        }}
      />
      <div aria-hidden className="absolute inset-0 z-0">
        <CalligraphyVerse />
      </div>

      {/* Central architectural arch, framing the card with warm light. */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 z-0 hidden h-[94vh] w-[64vh] -translate-x-1/2 -translate-y-1/2 opacity-80 lg:block"
      >
        <ArchedWindow className="inset-0 h-full w-full" />
      </div>

      {/* Twin lanterns */}
      <div className="absolute top-0 z-0 ltr:left-[17%] rtl:right-[17%]">
        <Lantern />
      </div>
      <div className="absolute top-0 z-0 hidden scale-90 opacity-90 lg:block ltr:right-[17%] rtl:left-[17%]">
        <Lantern />
      </div>

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
        <div className="relative w-[min(560px,92vw)]">
          {/* Soft gold + emerald glow pooled behind the card. */}
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-[64px] opacity-70 blur-3xl"
            style={{
              background:
                'radial-gradient(closest-side, rgba(16,185,129,0.22), transparent 70%), radial-gradient(closest-side at 70% 30%, rgba(201,162,39,0.14), transparent 72%)',
            }}
          />
          {/* One gentle entrance, then nothing moves. */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_EXPO }}
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
        </div>
      </div>

      {/* Trust bar */}
      <div className="relative z-20 px-4 pb-6">
        <TrustBar className="mx-auto w-full max-w-4xl" />
      </div>
    </div>
  );
}
