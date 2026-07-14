/**
 * Reference option lists for the profile. Values are stable codes stored in the
 * DB; the user-facing labels are translated via i18n (`profileOptions.*`), so no
 * copy is hardcoded. Free-form fields (name, country, city, university…) stay as
 * text inputs.
 */
export const EDUCATION_LEVELS = [
  'high_school',
  'diploma',
  'bachelor',
  'master',
  'doctorate',
  'other',
] as const;
export const EMPLOYMENT_STATUSES = [
  'employed',
  'self_employed',
  'business_owner',
  'student',
  'seeking',
  'other',
] as const;
export const LANGUAGES = ['ar', 'en', 'fr', 'tr', 'ur', 'fa', 'id', 'ms', 'other'] as const;

// jsonb sub-fields
export const MARRIAGE_TIMELINE = ['within_year', 'one_two_years', 'exploring'] as const;
export const CHILDREN_PREFERENCE = ['want', 'open', 'prefer_not'] as const;
export const RELOCATE_PREFERENCE = ['willing', 'open', 'stay'] as const;

export const RELIGIOSITY = ['practicing', 'moderate', 'growing'] as const;
export const SMOKING = ['no', 'sometimes', 'yes'] as const;

export const FAMILY_INVOLVEMENT = ['high', 'moderate', 'independent'] as const;
export const SAVINGS_READINESS = ['ready', 'building', 'early'] as const;

// Photo visibility (matches profiles.photo_privacy_mode 1..4)
export const PHOTO_PRIVACY_MODES = [1, 2, 3, 4] as const;

export type OptionGroup =
  | 'education'
  | 'employment'
  | 'language'
  | 'timeline'
  | 'children'
  | 'relocate'
  | 'religiosity'
  | 'smoking'
  | 'family'
  | 'savings'
  | 'photoPrivacy';
