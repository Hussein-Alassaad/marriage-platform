import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Sidebar } from '@/app/navigation/Sidebar';
import { TopBar } from '@/app/navigation/TopBar';
import { BottomNav } from '@/app/navigation/BottomNav';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { PageTransition } from '@/components/motion/PageTransition';
import { RouteFallback } from '@/components/RouteFallback';

/**
 * Primary app frame: sidebar (desktop), top bar (all sizes), and a floating
 * bottom nav (mobile). Routed content crossfades through <PageTransition> while
 * the shell stays put. Logical spacing keeps the layout correct in RTL.
 */
export function AppLayout() {
  const location = useLocation();
  const { t } = useTranslation();
  return (
    <div className="app-backdrop flex min-h-screen">
      {/* Keyboard-only: lets a screen-reader/keyboard user bypass the sidebar and
          top bar nav (repeated on every page) and jump straight to page content. */}
      <a
        href="#main-content"
        className="bg-brand-600 text-on-brand focus-visible:outline-brand-400 sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-4 focus-visible:outline-2 focus-visible:outline-offset-2 ltr:focus:left-4 rtl:focus:right-4"
      >
        {t('common.skipToContent')}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main-content" className="flex-1 px-4 pt-8 pb-28 md:px-8 md:pb-12">
          <div className="mx-auto w-full max-w-6xl">
            <PageTransition pathname={location.pathname}>
              <ErrorBoundary key={location.pathname}>
                {/* Only the content area waits while a lazy page's code arrives; the
                    sidebar and top bar never flicker. */}
                <Suspense fallback={<RouteFallback />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </PageTransition>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
