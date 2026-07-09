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
  'relative flex h-9 w-9 items-center justify-center rounded-xl text-muted transition duration-150',
  'hover:bg-canvas hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
);

export function TopBar() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line/80 bg-canvas/70 px-4 backdrop-blur-xl md:px-8">
      <div className="md:hidden">
        <Logo compact />
      </div>
      <div className="flex-1" />
      <LanguageSwitcher />
      <ThemeToggle />
      <NavLink to={ROUTES.notifications} className={iconLink} aria-label={t('nav.notifications')}>
        <Bell className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500 ring-2 ring-canvas" aria-hidden />
      </NavLink>
      <UserMenu />
    </header>
  );
}
