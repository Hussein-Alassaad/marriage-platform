import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { Logo } from '@/components/Logo';
import { cn } from '@/utils/cn';
import { springLayout } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { primaryNav, roleNav, settingsNav, type NavItem } from './navItems';

function SidebarLink({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === ROUTES.home}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'text-brand-800' : 'text-muted hover:bg-canvas hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.span
              layoutId="sidebar-active"
              transition={springLayout}
              className="absolute inset-0 z-0 rounded-xl bg-brand-50"
            >
              <span className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-brand-600" />
            </motion.span>
          ) : null}
          <Icon
            className={cn(
              'relative z-10 h-[1.15rem] w-[1.15rem] shrink-0 transition-colors',
              isActive ? 'text-brand-600' : 'text-faint group-hover:text-muted',
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

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1.5 pt-5 text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
      {children}
    </p>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e border-line bg-surface/70 backdrop-blur md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        {primaryNav.map((item) => (
          <SidebarLink key={item.key} item={item} />
        ))}

        <GroupLabel>{t('nav.rolePreview')}</GroupLabel>
        {roleNav.map((item) => (
          <SidebarLink key={item.key} item={item} />
        ))}

        <div className="mt-auto pt-4">
          <SidebarLink item={settingsNav} />
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-semibold text-brand-800">
            {t('common.guestInitial')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{t('common.guest')}</p>
            <p className="truncate text-xs text-faint">{t('common.freeMember')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
