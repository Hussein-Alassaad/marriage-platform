import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/utils/cn';
import { SPRING_SNAPPY } from '@/lib/motion';

/**
 * Segmented language control (MITHAQ §4.5): a sliding thumb (shared layoutId)
 * glides under the active language. Flips the document direction via
 * LanguageProvider — behaviour unchanged.
 */
export function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();

  const segment = (active: boolean) =>
    cn(
      'relative z-10 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
      active ? 'text-ink' : 'text-faint',
    );

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={t('common.switchLanguage')}
      className="relative inline-flex items-center gap-0.5 rounded-md border border-line bg-bg-3 p-0.5 transition duration-150 hover:border-line-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <span className={segment(language === 'en')}>
        {language === 'en' ? (
          <motion.span
            layoutId="lang-thumb"
            transition={SPRING_SNAPPY}
            className="absolute inset-0 -z-10 rounded-md bg-surface shadow-xs"
          />
        ) : null}
        EN
      </span>
      <span className={segment(language === 'ar')}>
        {language === 'ar' ? (
          <motion.span
            layoutId="lang-thumb"
            transition={SPRING_SNAPPY}
            className="absolute inset-0 -z-10 rounded-md bg-surface shadow-xs"
          />
        ) : null}
        ع
      </span>
    </button>
  );
}
