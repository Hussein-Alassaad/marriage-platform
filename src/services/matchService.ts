import { requireSupabaseClient } from '@/lib/supabase';

export interface Candidate {
  id: string;
  displayName: string | null;
  age: number | null;
  country: string | null;
  city: string | null;
  educationLevel: string | null;
  occupation: string | null;
  languages: string[];
  bio: string | null;
  goals: Record<string, string>;
  overall: number | null;
  breakdown: Record<string, number> | null;
  photoUrl: string | null;
  photoLocked: boolean;
  saved: boolean;
  /** Online/Activity Status (PRD Privacy Controls) — already filtered server-side
   *  by the candidate's own privacy toggle; null means "don't show anything". */
  lastActiveAt: string | null;
}

export interface InterestEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  person: Candidate | null;
}

export interface MatchEntry {
  id: string;
  stage: string;
  createdAt: string;
  person: Candidate | null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('matchmaking', { body });
  if (error) throw error;
  return data as T;
}

export interface DiscoverFilters {
  minAge?: number;
  maxAge?: number;
  country?: string;
  city?: string;
  educationLevel?: string;
}

export const matchService = {
  /** filters is Serious+ only server-side; the caller only ever sends it from a UI
   *  that's already gated on tier. */
  discover: (filters?: DiscoverFilters) =>
    invoke<{ candidates: Candidate[]; paid: boolean }>({ action: 'discover', filters }),
  connections: () =>
    invoke<{ incoming: InterestEntry[]; outgoing: InterestEntry[]; matches: MatchEntry[] }>({
      action: 'connections',
    }),
  sendInterest: (recipientId: string, note?: string) =>
    invoke<{ ok: boolean }>({ action: 'send-interest', recipientId, note }),
  respondInterest: (interestId: string, decision: 'accepted' | 'declined') =>
    invoke<{ ok: boolean }>({ action: 'respond-interest', interestId, decision }),

  /** Rebuild the caller's compatibility scores + today's ranked recommendations. */
  async refreshRecommendations(): Promise<{ count: number }> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('compute-compatibility', {
      body: { action: 'refresh' },
    });
    if (error) throw error;
    return data as { count: number };
  },

  /** Marriage Plus only: replaces today's list with profiles never shown before,
   *  rate-limited by `plus_refresh_per_day`. Throws with `.limit`/`.used` attached
   *  when the daily cap is already reached, so the UI can say exactly that. */
  async refreshPlus(): Promise<{ count: number; used: number; limit: number }> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('compute-compatibility', {
      body: { action: 'refresh_plus' },
    });
    if (error) throw error;
    if (data?.error) {
      const err = new Error(data.error) as Error & { used?: number; limit?: number };
      err.used = data.used;
      err.limit = data.limit;
      throw err;
    }
    return data as { count: number; used: number; limit: number };
  },

  // Personal collections — direct writes allowed by RLS (own rows).
  async save(userId: string, candidateId: string) {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('saved_profiles')
      .insert({ user_id: userId, candidate_id: candidateId });
    if (error) throw error;
  },
  async unsave(userId: string, candidateId: string) {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('saved_profiles')
      .delete()
      .eq('user_id', userId)
      .eq('candidate_id', candidateId);
    if (error) throw error;
  },
  async decline(userId: string, candidateId: string) {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('declined_profiles')
      .insert({ user_id: userId, candidate_id: candidateId });
    if (error) throw error;
  },
  async markViewed(userId: string, candidateId: string) {
    const supabase = requireSupabaseClient();
    await supabase
      .from('viewed_profiles')
      .upsert(
        { user_id: userId, candidate_id: candidateId },
        { onConflict: 'user_id,candidate_id', ignoreDuplicates: true },
      );
  },
};
