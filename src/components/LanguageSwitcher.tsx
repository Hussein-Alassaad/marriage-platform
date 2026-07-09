import { useTranslation } from 'react-i18next';

import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/utils/cn';

/**
 * A single toggle button styled as a segmented control. It flips between the two
 * languages (and, via LanguageProvider, the document direction) on click.
 */
export function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();

  const segment = (active: boolean) =>
    cn(
      'rounded-lg px-2 py-1 text-xs font-semibold transition',
      active ? 'bg-surface text-ink shadow-xs' : 'text-faint',
    );

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={t('common.switchLanguage')}
      className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-canvas p-0.5 transition duration-150 hover:border-line-strong active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className={segment(language === 'en')}>EN</span>
      <span className={segment(language === 'ar')}>ع</span>
    </button>
  );
}
