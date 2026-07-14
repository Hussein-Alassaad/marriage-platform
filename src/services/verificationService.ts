import { requireSupabaseClient } from '@/lib/supabase';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface VerificationRecord {
  id: string;
  status: VerificationStatus;
  document_type: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface SubmitVerificationInput {
  document: File;
  selfie?: File | null;
  documentType: string;
}

export const verificationService = {
  /** The user's most recent identity verification record (RLS: own only). */
  async getMyVerification(userId: string): Promise<VerificationRecord | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('identity_verifications')
      .select('id, status, document_type, rejection_reason, submitted_at, reviewed_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as VerificationRecord) ?? null;
  },

  /** Verified trust badges (email/phone/identity). */
  async getBadges(userId: string): Promise<string[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('verification_badges')
      .select('badge')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((b) => b.badge as string);
  },

  /**
   * Submit an identity document. Identity docs are server-only, so this posts to
   * the `verify-identity` Edge Function (service role uploads + records). Requires
   * the function to be deployed.
   */
  async submit({
    document,
    selfie,
    documentType,
  }: SubmitVerificationInput): Promise<{ status: VerificationStatus }> {
    const supabase = requireSupabaseClient();
    const form = new FormData();
    form.append('document', document);
    if (selfie) form.append('selfie', selfie);
    form.append('documentType', documentType);

    const { data, error } = await supabase.functions.invoke('verify-identity', { body: form });
    if (error) throw error;
    return data as { status: VerificationStatus };
  },
};
