import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthMascot } from '@/components/AuthMascot';
import { PageTransition } from '@/components/motion/PageTransition';
import { AuroraBackground } from '@/components/motion/AuroraBackground';
import { GeometricVeil } from '@/components/motion/GeometricVeil';

/** Centered, distraction-free frame for auth screens (login / register). */
export function AuthLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <div className="app-backdrop relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AuroraBackground />
      <GeometricVeil />
      <div className="relative w-full max-w-md">
        {/* The character leans in from the side and pushes the card (lg+ only).
            Mirrored under RTL so it always pushes toward the form. */}
        <AuthMascot className="absolute top-1/2 z-10 hidden -translate-y-1/2 lg:block ltr:end-full ltr:-me-4 rtl:start-full rtl:-ms-4 rtl:-scale-x-100" />
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted">{t('common.motto')}</p>
        </div>
        <PageTransition pathname={location.pathname}>
          <Outlet />
        </PageTransition>
        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
