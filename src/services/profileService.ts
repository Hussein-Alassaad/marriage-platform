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
  'id, display_name, dob, gender, gender_locked, nationality, country, city, languages, education_level, university, major, graduation_year, occupation, industry, employment_status, career_goals, marriage_goals, lifestyle, family_values, financial_readiness, bio, photo_privacy_mode, privacy, profile_completion, verification_status, subscription_tier';

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
