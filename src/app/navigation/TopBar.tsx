import { NavLink } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from './UserMenu';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';
import { useUnreadCount } from '@/hooks/useNotifications';

const iconLink = cn(
  'relative flex h-10 w-10 items-center justify-center rounded-md text-muted transition duration-150',
  'hover:bg-bg-3 hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
);

export function TopBar() {
  const { t } = useTranslation();
  const unread = useUnreadCount();
  return (
    <header className="glass-solid border-line sticky top-0 z-20 flex h-16 items-center gap-2 border-b px-4 md:h-[72px] md:px-8">
      <div className="md:hidden">
        <Logo compact />
      </div>
      <div className="flex-1" />
      <LanguageSwitcher />
      <ThemeToggle />
      {/* The dot used to be permanently lit, which taught people to ignore it. It now
          means exactly one thing: you have unread notifications. */}
      <NavLink
        to={ROUTES.notifications}
        className={iconLink}
        aria-label={
          unread ? t('notifications.unreadAria', { count: unread }) : t('nav.notifications')
        }
      >
        <Bell className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        {unread > 0 ? (
          <span
            className="bg-brand-500 text-on-brand absolute end-1.5 top-1.5 flex min-w-[1.05rem] items-center justify-center rounded-full px-1 text-[0.65rem] leading-4 font-semibold"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </NavLink>
      <UserMenu />
    </header>
  );
}
