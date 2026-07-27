import { requireSupabaseClient } from '@/lib/supabase';

export type Gender = 'man' | 'woman';
export type JsonMap = Record<string, string>;

/** The full marriage profile row (owner-readable/writable via RLS). */
export interface ProfileRecord {
  id: string;
  display_name: string | null;
  dob: string | null;
  gender: Gender | null;
  gender_locked: boolean;
  nationality: string | null;
  country: string | null;
  city: string | null;
  languages: string[];
  education_level: string | null;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  occupation: string | null;
  industry: string | null;
  employment_status: string | null;
  career_goals: string | null;
  marriage_goals: JsonMap;
  lifestyle: JsonMap;
  family_values: JsonMap;
  financial_readiness: JsonMap;
  bio: string | null;
  photo_privacy_mode: number;
  privacy: Record<string, unknown>;
  profile_completion: number;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  subscription_tier: 'free' | 'serious' | 'marriage_plus';
  created_at: string;
}

/** The subset a user may edit from onboarding / profile (RLS + triggers enforce the rest). */
export type ProfilePatch = Partial<
  Pick<
    ProfileRecord,
    | 'display_name'
    | 'dob'
    | 'gender'
    | 'nationality'
    | 'country'
    | 'city'
    | 'languages'
    | 'education_level'
    | 'university'
    | 'major'
    | 'graduation_year'
    | 'occupation'
    | 'industry'
    | 'employment_status'
    | 'career_goals'
    | 'marriage_goals'
    | 'lifestyle'
    | 'family_values'
    | 'financial_readiness'
    | 'bio'
    | 'photo_privacy_mode'
    | 'privacy'
    | 'profile_completion'
  >
>;

const SELECT =
  'id, display_name, dob, gender, gender_locked, nationality, country, city, languages, education_level, university, major, graduation_year, occupation, industry, employment_status, career_goals, marriage_goals, lifestyle, family_values, financial_readiness, bio, photo_privacy_mode, privacy, profile_completion, verification_status, subscription_tier, created_at';

const notEmpty = (m: JsonMap | null | undefined) =>
  !!m && Object.values(m).some((v) => v !== '' && v != null);

/** Completion checks — pure, so it's unit-testable and stable across the app. */
export function computeCompletion(
  p: Pick<
    ProfileRecord,
    | 'display_name'
    | 'dob'
    | 'gender'
    | 'country'
    | 'city'
    | 'nationality'
    | 'languages'
    | 'education_level'
    | 'occupation'
    | 'employment_status'
    | 'bio'
    | 'marriage_goals'
    | 'lifestyle'
    | 'family_values'
    | 'financial_readiness'
  >,
): number {
  const checks = [
    !!p.display_name,
    !!p.dob,
    !!p.gender,
    !!p.country,
    !!p.city,
    !!p.nationality,
    (p.languages?.length ?? 0) > 0,
    !!p.education_level,
    !!p.occupation,
    !!p.employment_status,
    !!p.bio,
    notEmpty(p.marriage_goals),
    notEmpty(p.lifestyle),
    notEmpty(p.family_values),
    notEmpty(p.financial_readiness),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Marriage Readiness Score (PRD Part 5) — five equal, binary checks, exactly as the
 * PRD frames them ("✓ Completed profile", "✓ Identity verified", …). Deterministic,
 * like the compatibility engine and the finance reports — no AI key required.
 *
 * The PRD requires this stay informational only: "It must never be presented as an
 * objective measure of someone's worth or suitability for marriage." Any UI showing
 * this number carries that disclaimer — see `profile.readiness.disclaimer` in i18n.
 */
export function computeMarriageReadiness(
  p: Pick<
    ProfileRecord,
    'profile_completion' | 'verification_status' | 'marriage_goals' | 'financial_readiness' | 'lifestyle'
  >,
): number {
  const checks = [
    p.profile_completion >= 100,
    p.verification_status === 'verified',
    notEmpty(p.marriage_goals),
    notEmpty(p.financial_readiness),
    notEmpty(p.lifestyle),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Profile Quality Score (PRD Part 5): Profile Picture Quality, Biography Quality,
 * Questionnaire Completion, Verification Status, Marriage Readiness — averaged
 * equally. Picture/bio "quality" has no AI judge here (no key), so each is a
 * deterministic proxy: photo count for pictures, length for the bio. Same
 * transparency tradeoff as the rest of this platform's scores.
 */
export function computeProfileQuality(
  p: Pick<
    ProfileRecord,
    | 'profile_completion'
    | 'verification_status'
    | 'bio'
    | 'marriage_goals'
    | 'financial_readiness'
    | 'lifestyle'
  >,
  photoCount: number,
): number {
  const pictureQuality = photoCount >= 3 ? 100 : photoCount === 2 ? 70 : photoCount === 1 ? 50 : 0;
  const bioLength = p.bio?.trim().length ?? 0;
  const bioQuality = bioLength === 0 ? 0 : Math.min(100, Math.round((bioLength / 200) * 100));
  const verificationScore =
    p.verification_status === 'verified' ? 100 : p.verification_status === 'pending' ? 50 : 0;
  const marriageReadiness = computeMarriageReadiness(p);

  return Math.round(
    (pictureQuality + bioQuality + p.profile_completion + verificationScore + marriageReadiness) / 5,
  );
}

/**
 * Trust Score (PRD Part 5, "Trust & Safety"): identity verification, profile
 * completeness, respectful communication / policy violations, and account age —
 * equally weighted, deterministic (no AI key). "Reports (after review)" and
 * "positive engagement" are in the PRD's own "may consider" list, not a mandatory
 * one — omitted here because there is no reporting/blocking feature and no
 * engagement metric anywhere in the schema to back them, same as Financial
 * Health's optional Debt Level being left out for lacking a data source.
 *
 * "Respectful communication" and "policy violations" are the same underlying
 * signal (the violations table) rather than two independent factors — counting
 * it twice would double its weight for no reason.
 *
 * "The score must never discriminate based on race, nationality, religion,
 * ethnicity, disability, or any protected characteristic" (PRD) — none of the
 * four factors here touch any of those, by construction.
 */
export function computeTrustScore(
  p: Pick<ProfileRecord, 'profile_completion' | 'verification_status' | 'created_at'>,
  violationCount: number,
): number {
  const verificationScore =
    p.verification_status === 'verified' ? 100 : p.verification_status === 'pending' ? 50 : 0;
  const conductScore =
    violationCount === 0 ? 100 : violationCount === 1 ? 70 : violationCount <= 3 ? 40 : 10;
  const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
  const accountAgeScore = Math.max(0, Math.min(100, Math.round((ageDays / 90) * 100)));

  return Math.round((verificationScore + p.profile_completion + conductScore + accountAgeScore) / 4);
}

/** Actionable suggestions (PRD Part 5 examples), ordered by impact. */
export function profileQualitySuggestions(
  p: Pick<ProfileRecord, 'education_level' | 'bio' | 'verification_status'>,
  photoCount: number,
): ('photo' | 'verify' | 'bio' | 'education')[] {
  const suggestions: ('photo' | 'verify' | 'bio' | 'education')[] = [];
  if (photoCount === 0) suggestions.push('photo');
  if (p.verification_status !== 'verified') suggestions.push('verify');
  if (!p.bio || p.bio.trim().length < 100) suggestions.push('bio');
  if (!p.education_level) suggestions.push('education');
  return suggestions;
}

export interface ProfilePhoto {
  name: string;
  path: string;
  url: string;
  isPrimary: boolean;
}

const BUCKET = 'profile-photos';

export const profileService = {
  async getMyProfile(userId: string): Promise<ProfileRecord | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(SELECT)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as ProfileRecord) ?? null;
  },

  async updateMyProfile(userId: string, patch: ProfilePatch): Promise<ProfileRecord> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as ProfileRecord;
  },

  /** List the user's photos (own folder) with fresh signed URLs. */
  async listPhotos(userId: string, primaryPath?: string): Promise<ProfilePhoto[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const files = (data ?? []).filter((f) => f.id !== null);
    const photos = await Promise.all(
      files.map(async (f) => {
        const path = `${userId}/${f.name}`;
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        return {
          name: f.name,
          path,
          url: signed?.signedUrl ?? '',
          isPrimary: path === primaryPath,
        };
      }),
    );
    return photos;
  },

  async uploadPhoto(userId: string, file: File): Promise<string> {
    const supabase = requireSupabaseClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  async deletePhoto(path: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  },
};
