import { useLanguage } from './useLanguage';
import type { Direction } from '@/contexts/LanguageContext';

/** Current text direction ('ltr' | 'rtl'), derived from the active language. */
export function useDirection(): Direction {
  return useLanguage().direction;
}
