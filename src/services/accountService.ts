import { requireSupabaseClient } from '@/lib/supabase';

/**
 * Export and deletion are obligations, not features. A platform holding someone's identity
 * documents and private conversations has no business shipping without them.
 */
export const accountService = {
  /** Everything the platform holds about you. Not the other person's words — those are theirs. */
  async exportData(): Promise<Record<string, unknown>> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'export' },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as Record<string, unknown>;
  },

  /** Irreversible. The server demands an explicit confirmation, not a single click. */
  async deleteAccount(): Promise<void> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('account', {
      body: { action: 'delete', confirm: true },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },
};
