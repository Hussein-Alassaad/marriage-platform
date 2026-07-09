/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';

export type Direction = 'ltr' | 'rtl';

export interface LanguageContextValue {
  language: AppLanguage;
  direction: Direction;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

function directionFor(language: AppLanguage): Direction {
  return language === 'ar' ? 'rtl' : 'ltr';
}

function normalize(language: string): AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
    ? (language as AppLanguage)
    : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const language = normalize(i18n.language);
  const direction = directionFor(language);

  // Keep the document's language and direction in sync — this is what makes
  // the whole layout flip between LTR and RTL.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      void i18n.changeLanguage(next);
    },
    [i18n],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  }, [language, setLanguage]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, direction, setLanguage, toggleLanguage }),
    [language, direction, setLanguage, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
