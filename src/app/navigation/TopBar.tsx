import { NavLink } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from './UserMenu';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';

const iconLink = cn(
  'relative flex h-10 w-10 items-center justify-center rounded-md text-muted transition duration-150',
  'hover:bg-bg-3 hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
);

export function TopBar() {
  const { t } = useTranslation();
  return (
    <header className="glass sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line px-4 md:h-[72px] md:px-8">
      <div className="md:hidden">
        <Logo compact />
      </div>
      <div className="flex-1" />
      <LanguageSwitcher />
      <ThemeToggle />
      <NavLink to={ROUTES.notifications} className={iconLink} aria-label={t('nav.notifications')}>
        <Bell className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        <span className="absolute end-2 top-2 flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 [animation:pulse-ring_2s_ease-out_infinite]" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
      </NavLink>
      <UserMenu />
    </header>
  );
}
