import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Settings, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/hooks/useSession';
import { cn } from '@/utils/cn';
import { EASE_OUT_EXPO } from '@/lib/motion';
import { ROUTES } from '@/app/routes';

export function UserMenu() {
  const { t } = useTranslation();
  const { profile, signOut } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (profile?.display_name?.[0] ?? t('common.guestInitial')).toUpperCase();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate(ROUTES.login, { replace: true });
  };

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink transition-colors hover:bg-canvas';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.profile')}
        className="from-brand-100 to-brand-200 text-brand-800 focus-visible:outline-brand-600 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
      >
        {initial}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: EASE_OUT_EXPO }}
            className="border-line bg-raised shadow-elevated absolute end-0 top-11 z-30 w-52 rounded-xl border p-1.5"
          >
            {profile?.display_name ? (
              <p className="text-faint truncate px-2.5 pt-1 pb-1.5 text-xs">
                {profile.display_name}
              </p>
            ) : null}
            <NavLink
              to={ROUTES.profile}
              className={itemClass}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <User className="text-muted h-4 w-4" aria-hidden />
              {t('nav.profile')}
            </NavLink>
            <NavLink
              to={ROUTES.settings}
              className={itemClass}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Settings className="text-muted h-4 w-4" aria-hidden />
              {t('nav.settings')}
            </NavLink>
            <div className="border-line my-1 border-t" />
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(itemClass, 'text-danger')}
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t('auth.signOut')}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
