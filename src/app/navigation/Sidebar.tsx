import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/Logo';
import { cn } from '@/utils/cn';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { guardiansNav, plansNav, primaryNav, roleNav, settingsNav, type NavItem } from './navItems';

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(`nav.${item.key}`);
  return (
    <NavLink
      to={item.path}
      end={item.path === ROUTES.home}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-12 items-center gap-3 rounded-md px-4 text-[0.9rem] font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'text-brand-700' : 'text-muted hover:bg-bg-3 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* A plain conditional, not a Framer Motion layoutId/shared-layout
              animation: layoutId measures this element's position via the DOM
              to animate it sliding between nav items across route changes, and
              that measurement got corrupted by the sidebar's own width also
              changing (hover expand/collapse) at the same time — it rendered
              as a stretched, mispositioned blob that visually covered other
              nav items. A plain per-item background can't do that; it's
              always sized to exactly its own item. */}
          {isActive ? (
            <span className="absolute inset-0 z-0 rounded-md border border-[color:var(--color-border-accent)] [background:linear-gradient(90deg,var(--color-brand-wash),transparent)]">
              <span className="bg-brand-400 absolute inset-y-3 start-0 w-[3px] rounded-full" />
            </span>
          ) : null}
          <Icon
            className={cn(
              'relative z-10 h-5 w-5 shrink-0 transition-colors',
              isActive ? 'text-brand-500' : 'text-faint group-hover:text-muted',
            )}
            aria-hidden
          />
          {/* w-0 is an instant snap, not an animated property (only opacity is
              in the transition list) — one single reflow at the moment of
              toggle, not recalculated every frame. Needed: at natural width
              with only opacity hidden, the invisible label still occupies
              layout space, so the row (and the active-item background sized
              to it) was rendering wider than the visible 76px rail and
              getting clipped into a stretched, mispositioned shape. */}
          <span
            className={cn(
              'relative z-10 overflow-hidden text-nowrap transition-opacity duration-150',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { profile, hasRole } = useSession();
  // Hover-driven, not a persisted choice: collapsed by default, expands while
  // the pointer is over it, collapses again the moment it leaves. No local
  // storage — there's nothing to remember, it's purely "is the mouse here".
  const [collapsed, setCollapsed] = useState(true);

  // Role items appear only for users who actually hold the role (real gating).
  const roleItems = roleNav.filter((item) =>
    item.key === 'admin' ? hasRole('admin', 'super_admin') : hasRole('guardian'),
  );

  const name = profile?.display_name ?? t('common.guest');
  const initial = (profile?.display_name?.[0] ?? t('common.guestInitial')).toUpperCase();
  const tier = profile?.subscription_tier ?? 'free';

  return (
    <aside
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      // Plain CSS transition, not Framer Motion spring physics — a spring
      // re-runs layout on every animation frame via JS; a native CSS
      // transition lets the browser handle it directly, which is
      // noticeably smoother for a layout-affecting property like width.
      className={cn(
        'border-line bg-panel hidden shrink-0 flex-col overflow-hidden border-e transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-[76px]' : 'w-72',
      )}
    >
      <div className={cn('flex h-[72px] items-center', collapsed ? 'justify-center px-0' : 'px-5')}>
        <Logo compact={collapsed} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {primaryNav.map((item) => (
          <SidebarLink key={item.key} item={item} collapsed={collapsed} />
        ))}

        {roleItems.length > 0 ? (
          <>
            <div className="border-line my-2 border-t" />
            {roleItems.map((item) => (
              <SidebarLink key={item.key} item={item} collapsed={collapsed} />
            ))}
          </>
        ) : null}

        <div className="mt-auto pt-4">
          {/* Only she can invite a guardian (Decisions §9), so only she sees the entry. */}
          {profile?.gender === 'woman' ? (
            <SidebarLink item={guardiansNav} collapsed={collapsed} />
          ) : null}
          <SidebarLink item={plansNav} collapsed={collapsed} />
          <SidebarLink item={settingsNav} collapsed={collapsed} />
        </div>
      </nav>

      <div className={cn('border-line border-t p-3', collapsed && 'flex justify-center px-0')}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl px-2 py-1.5',
            collapsed && 'gap-0 px-0',
          )}
        >
          <span className="from-brand-100 to-brand-200 text-brand-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold">
            {initial}
          </span>
          <div
            className={cn(
              'min-w-0 overflow-hidden transition-opacity duration-150',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
            )}
          >
            <p className="text-ink truncate text-sm font-medium text-nowrap">{name}</p>
            <p className="text-faint truncate text-xs text-nowrap">{t(`tier.${tier}`)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
