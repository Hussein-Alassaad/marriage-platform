import { useEffect, type PointerEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/motion/PageTransition';
import { AuroraBackground } from '@/components/motion/AuroraBackground';
import { GeometricVeil } from '@/components/motion/GeometricVeil';
import { Starfield } from '@/features/auth/scene/Starfield';
import { ArchedWindow } from '@/features/auth/scene/ArchedWindow';
import { Lantern } from '@/features/auth/scene/Lantern';
import { AuthCharacter } from '@/features/auth/scene/AuthCharacter';
import { TrustBar } from '@/features/auth/scene/TrustBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePointerFine } from '@/hooks/usePointerFine';
import { useLanguage } from '@/hooks/useLanguage';
import { dx, EASE_EXPO } from '@/lib/motion';

// Drop character art at these paths (public/) to upgrade from the silhouettes.
const MAN_SRC = '/auth/char-man.png';
const WOMAN_SRC = '/auth/char-woman.png';

/**
 * "Covenant Threshold" — a cinematic sign-in scene. Two dignified figures
 * approach a glowing arched threshold from their own sides toward a glass card;
 * layered atmosphere (starfield · geometric lattice · aurora · arched window ·
 * lantern) builds depth without WebGL. Choreographed entrance, idle life, and
 * pointer parallax. Content/routing/i18n/validation are untouched.
 */
export function AuthLayout() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const pointerFine = usePointerFine();
  const { direction } = useLanguage();
  const rtl = direction === 'rtl';

  const parallax = isDesktop && pointerFine && !reduced;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 50, damping: 18, mass: 0.6 });

  const archX = useTransform(sx, [-1, 1], [-8, 8]);
  const archY = useTransform(sy, [-1, 1], [-8, 8]);
  const lanternX = useTransform(sx, [-1, 1], [-14, 14]);
  const lanternY = useTransform(sy, [-1, 1], [-14, 14]);
  const charX = useTransform(sx, [-1, 1], [10, -10]);
  const cardX = useTransform(sx, [-1, 1], [-4, 4]);
  const cardY = useTransform(sy, [-1, 1], [-4, 4]);

  // Homage nudge: one soft card recoil as the figures arrive at the threshold.
  const nudge = useMotionValue(0);
  useEffect(() => {
    if (reduced) return;
    const c = animate(nudge, [0, -4, 0], { duration: 0.5, ease: 'easeInOut', delay: 1.3 });
    return () => c.stop();
  }, [reduced, nudge]);

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
      <Starfield />
      <GeometricVeil />
      <AuroraBackground />

      <motion.div
        aria-hidden
        style={parallax ? { x: archX, y: archY } : undefined}
        className="pointer-events-none absolute bottom-0 top-1/2 z-0 hidden h-[72vh] w-[42vh] -translate-y-1/2 lg:block ltr:left-[3%] rtl:right-[3%] rtl:-scale-x-100"
      >
        <ArchedWindow className="inset-0 h-full w-full" />
      </motion.div>

      <motion.div
        style={parallax ? { x: lanternX, y: lanternY } : undefined}
        className="absolute top-0 z-0 ltr:left-[28%] rtl:right-[28%]"
      >
        <Lantern />
      </motion.div>

      {/* Characters flanking the threshold */}
      <motion.div
        style={parallax ? { x: charX } : undefined}
        className="absolute bottom-0 z-10 h-[24vh] opacity-90 ltr:left-0 rtl:right-0 md:h-[56vh] lg:h-[80vh] lg:opacity-100"
      >
        <AuthCharacter variant="man" fromX={dx(-60)} flip={rtl} src={MAN_SRC} bob={4.2} className="h-full" />
      </motion.div>
      <motion.div
        style={parallax ? { x: charX } : undefined}
        className="absolute bottom-0 z-10 h-[23vh] opacity-90 ltr:right-0 rtl:left-0 md:h-[54vh] lg:h-[78vh] lg:opacity-100"
      >
        <AuthCharacter variant="woman" fromX={dx(60)} flip={rtl} src={WOMAN_SRC} bob={4.6} className="h-full" />
      </motion.div>

      {/* Top-end controls */}
      <div className="absolute top-4 z-30 flex items-center gap-2 ltr:right-4 rtl:left-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="relative z-20 flex flex-1 items-center justify-center px-4 pb-6 pt-16 sm:pt-12">
        <motion.div style={parallax ? { x: cardX, y: cardY } : undefined} className="w-[min(560px,92vw)]">
          <motion.div
            style={{ x: nudge }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_EXPO, delay: 0.6 }}
            className="auth-card-glass relative overflow-hidden rounded-[40px_40px_24px_24px] border border-line [box-shadow:0_24px_80px_rgba(0,0,0,0.5),var(--inner-hi)]"
          >
            {/* Edge glow — both figures "touch the light". */}
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-brand-500/15 to-transparent" />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-brand-500/15 to-transparent" />
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
