import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/useTheme';

/** Sun/moon toggle. The icon crossfades + rotates on switch (spring, ~300ms). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t('common.toggleTheme')}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted transition duration-150 hover:bg-canvas hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="inline-flex"
        >
          {isDark ? (
            <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden />
          ) : (
            <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
