import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';

export type Gender = 'man' | 'woman';
export type AppRole = 'user' | 'guardian' | 'admin' | 'super_admin' | 'moderator';

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
}

export interface Profile {
  id: string;
  display_name: string | null;
  gender: Gender | null;
  gender_locked: boolean;
  dob: string | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  subscription_tier: 'free' | 'serious' | 'marriage_plus';
}

function client() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

const redirectTo = (path: string) =>
  typeof window !== 'undefined' ? `${window.location.origin}${path}` : undefined;

/**
 * All authentication flows funnel through here. Security is enforced by Supabase
 * Auth + the database (RLS, triggers); these are the client entry points only.
 */
export const authService = {
  signUp({ email, password, displayName, gender, dob }: SignUpParams) {
    // Metadata is read by the handle_new_user() trigger to seed the profile;
    // the min-age trigger enforces `min_age` on the resulting DOB insert.
    return client().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo('/auth/callback'),
        data: { display_name: displayName, gender, dob },
      },
    });
  },

  signIn(email: string, password: string) {
    return client().auth.signInWithPassword({ email, password });
  },

  signOut() {
    return client().auth.signOut();
  },

  getSession() {
    return client().auth.getSession();
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return client().auth.onAuthStateChange(callback);
  },

  resendConfirmation(email: string) {
    return client().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo('/auth/callback') },
    });
  },

  requestPasswordReset(email: string) {
    return client().auth.resetPasswordForEmail(email, { redirectTo: redirectTo('/reset-password') });
  },

  updatePassword(password: string) {
    return client().auth.updateUser({ password });
  },

  /** Phone verification (requires an SMS provider configured in Supabase Auth). */
  startPhoneVerification(phone: string) {
    return client().auth.updateUser({ phone });
  },

  verifyPhone(phone: string, token: string) {
    return client().auth.verifyOtp({ phone, token, type: 'phone_change' });
  },

  /** Load the signed-in user's profile + roles (RLS restricts these to self). */
  async fetchProfileAndRoles(userId: string): Promise<{ profile: Profile | null; roles: AppRole[] }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { profile: null, roles: [] };
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, gender, gender_locked, dob, verification_status, subscription_tier')
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    return {
      profile: (profile as Profile) ?? null,
      roles: (roleRows ?? []).map((r) => r.role as AppRole),
    };
  },
};
