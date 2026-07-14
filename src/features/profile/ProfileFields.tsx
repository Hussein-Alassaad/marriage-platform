/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from 'react-i18next';

import { Select } from '@/components/Select';
import { cn } from '@/utils/cn';
import {
  CHILDREN_PREFERENCE,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  FAMILY_INVOLVEMENT,
  LANGUAGES,
  MARRIAGE_TIMELINE,
  PHOTO_PRIVACY_MODES,
  RELIGIOSITY,
  RELOCATE_PREFERENCE,
  SAVINGS_READINESS,
  SMOKING,
  type OptionGroup,
} from './profileOptions';

const GROUPS: Record<OptionGroup, readonly string[]> = {
  education: EDUCATION_LEVELS,
  employment: EMPLOYMENT_STATUSES,
  language: LANGUAGES,
  timeline: MARRIAGE_TIMELINE,
  children: CHILDREN_PREFERENCE,
  relocate: RELOCATE_PREFERENCE,
  religiosity: RELIGIOSITY,
  smoking: SMOKING,
  family: FAMILY_INVOLVEMENT,
  savings: SAVINGS_READINESS,
  photoPrivacy: PHOTO_PRIVACY_MODES.map(String),
};

/** Translate an option value; safe fallback to the raw value. */
export function useOptionLabel() {
  const { t } = useTranslation();
  return (group: OptionGroup, value: string | null | undefined) =>
    value ? t(`profileOptions.${group}.${value}`, { defaultValue: value }) : '';
}

interface OptionSelectProps {
  id: string;
  group: OptionGroup;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A Select bound to a reference option group (labels from i18n). */
export function OptionSelect({ id, group, value, onChange, placeholder }: OptionSelectProps) {
  const { t } = useTranslation();
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder ?? t('common.selectPlaceholder')}</option>
      {GROUPS[group].map((v) => (
        <option key={v} value={v}>
          {t(`profileOptions.${group}.${v}`, { defaultValue: v })}
        </option>
      ))}
    </Select>
  );
}

interface LanguagesFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/** Toggleable language chips (writes profiles.languages[]). */
export function LanguagesField({ value, onChange }: LanguagesFieldProps) {
  const { t } = useTranslation();
  const toggle = (lang: string) =>
    onChange(value.includes(lang) ? value.filter((l) => l !== lang) : [...value, lang]);

  return (
    <div className="flex flex-wrap gap-2">
      {LANGUAGES.map((lang) => {
        const active = value.includes(lang);
        return (
          <button
            key={lang}
            type="button"
            onClick={() => toggle(lang)}
            aria-pressed={active}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-wash text-brand-700 border-[color:var(--color-border-accent)]'
                : 'border-line-strong text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {t(`profileOptions.language.${lang}`, { defaultValue: lang })}
          </button>
        );
      })}
    </div>
  );
}
