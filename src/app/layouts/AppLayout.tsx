import { Outlet, useLocation } from 'react-router-dom';

import { Sidebar } from '@/app/navigation/Sidebar';
import { TopBar } from '@/app/navigation/TopBar';
import { BottomNav } from '@/app/navigation/BottomNav';
import { PageTransition } from '@/components/motion/PageTransition';

/**
 * Primary app frame: sidebar (desktop), top bar (all sizes), and a floating
 * bottom nav (mobile). Routed content crossfades through <PageTransition> while
 * the shell stays put. Logical spacing keeps the layout correct in RTL.
 */
export function AppLayout() {
  const location = useLocation();
  return (
    <div className="app-backdrop flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 pb-28 pt-8 md:px-8 md:pb-12">
          <div className="mx-auto w-full max-w-6xl">
            <PageTransition pathname={location.pathname}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
