import { requireSupabaseClient } from '@/lib/supabase';

/**
 * Support tickets are a direct client write — RLS lets a member insert/read their
 * own (`support_tickets_insert_own`/`support_tickets_rw_own`); nothing here crosses
 * users, so there is no need for an Edge Function.
 */
export type TicketCategory = 'payment' | 'technical' | 'bug' | 'feature' | 'general';

export const supportService = {
  /** "Can't pay? Contact us" (PRD) and general support both land here, keyed by category. */
  async createTicket(
    userId: string,
    input: { category: TicketCategory; subject: string; body: string },
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('support_tickets').insert({
      user_id: userId,
      category: input.category,
      subject: input.subject,
      body: input.body,
    });
    if (error) throw error;
  },
};
