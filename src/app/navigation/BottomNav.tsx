import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/utils/cn';
import { springLayout } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { bottomNav } from './navItems';

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {/* No backdrop-blur: this bar is always on screen, and blurring the page behind it
          on every scroll frame is costly. A near-opaque surface reads the same. */}
      <div className="border-line bg-surface/95 shadow-elevated mx-auto flex max-w-md items-stretch justify-around rounded-2xl border p-1.5">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const label = item.key === 'assistant' ? t('nav.assistantShort') : t(`nav.${item.key}`);
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === ROUTES.home}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[0.7rem] font-medium transition duration-150 active:scale-95',
                  isActive ? 'text-brand-700' : 'text-faint hover:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      layoutId="bottomnav-active"
                      transition={springLayout}
                      className="absolute inset-0 z-0 rounded-xl border border-[color:var(--color-border-accent)] [background:linear-gradient(180deg,var(--color-brand-wash),transparent)]"
                    />
                  ) : null}
                  <Icon className="relative z-10 h-5 w-5" aria-hidden />
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
