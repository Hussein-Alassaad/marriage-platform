import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { Logo } from '@/components/Logo';
import { cn } from '@/utils/cn';
import { springLayout } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { guardiansNav, plansNav, primaryNav, roleNav, settingsNav, type NavItem } from './navItems';

const WIDTH_EXPANDED = 288; // 18rem, matches the previous fixed w-72
const WIDTH_COLLAPSED = 76;

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
          {isActive ? (
            <motion.span
              layoutId="sidebar-active"
              transition={springLayout}
              className="absolute inset-0 z-0 rounded-md border border-[color:var(--color-border-accent)] [background:linear-gradient(90deg,var(--color-brand-wash),transparent)]"
            >
              <span className="bg-brand-400 absolute inset-y-3 start-0 w-[3px] rounded-full" />
            </motion.span>
          ) : null}
          <Icon
            className={cn(
              'relative z-10 h-5 w-5 shrink-0 transition-colors',
              isActive ? 'text-brand-500' : 'text-faint group-hover:text-muted',
            )}
            aria-hidden
          />
          {/* Width/opacity animated, not unmounted — stays in the accessibility
              tree for screen readers even while visually collapsed, and gives
              the expand/collapse a smooth reveal instead of a hard cut. */}
          <span
            className={cn(
              'relative z-10 overflow-hidden text-nowrap transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
              !isActive && !collapsed && 'group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5',
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
    <motion.aside
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      animate={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED }}
      transition={springLayout}
      className="border-line bg-panel hidden shrink-0 flex-col overflow-hidden border-e md:flex"
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
              'min-w-0 overflow-hidden transition-[opacity,width] duration-150',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
            )}
          >
            <p className="text-ink truncate text-sm font-medium text-nowrap">{name}</p>
            <p className="text-faint truncate text-xs text-nowrap">{t(`tier.${tier}`)}</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
