import { useContext } from 'react';

import { LanguageContext, type LanguageContextValue } from '@/contexts/LanguageContext';

/** Access the active language, text direction, and switchers. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
