import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { Logo } from '@/components/Logo';
import { cn } from '@/utils/cn';
import { springLayout } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { plansNav, primaryNav, roleNav, settingsNav, type NavItem } from './navItems';

function SidebarLink({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === ROUTES.home}
      className={({ isActive }) =>
        cn(
          'group relative flex h-12 items-center gap-3 rounded-md px-4 text-[0.9rem] font-medium transition-colors',
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
              <span className="absolute inset-y-3 start-0 w-[3px] rounded-full bg-brand-400" />
            </motion.span>
          ) : null}
          <Icon
            className={cn(
              'relative z-10 h-5 w-5 shrink-0 transition-colors',
              isActive ? 'text-brand-500' : 'text-faint group-hover:text-muted',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'relative z-10 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
              !isActive && 'group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5',
            )}
          >
            {t(`nav.${item.key}`)}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { profile, hasRole } = useSession();

  // Role items appear only for users who actually hold the role (real gating).
  const roleItems = roleNav.filter((item) =>
    item.key === 'admin' ? hasRole('admin', 'super_admin') : hasRole('guardian'),
  );

  const name = profile?.display_name ?? t('common.guest');
  const initial = (profile?.display_name?.[0] ?? t('common.guestInitial')).toUpperCase();
  const tier = profile?.subscription_tier ?? 'free';

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-e border-line bg-panel md:flex">
      <div className="flex h-[72px] items-center px-5">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        {primaryNav.map((item) => (
          <SidebarLink key={item.key} item={item} />
        ))}

        {roleItems.length > 0 ? (
          <>
            <div className="my-2 border-t border-line" />
            {roleItems.map((item) => (
              <SidebarLink key={item.key} item={item} />
            ))}
          </>
        ) : null}

        <div className="mt-auto pt-4">
          <SidebarLink item={plansNav} />
          <SidebarLink item={settingsNav} />
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-semibold text-brand-800">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-faint">{t(`tier.${tier}`)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
