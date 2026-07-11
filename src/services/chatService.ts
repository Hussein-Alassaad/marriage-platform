import { requireSupabaseClient } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  sender_id: string;
  type: string;
  body: string | null;
  created_at: string;
}

export interface SendResult {
  ok?: boolean;
  blocked?: boolean;
  category?: string;
  remaining?: number | null;
  conversationId?: string;
}

export interface StageRequirement {
  key: string;
  met: boolean;
}

export interface StageStatus {
  stage: string;
  next: string | null;
  youConsented: boolean;
  theyConsented: boolean;
  requirements: StageRequirement[];
  advanced?: boolean;
}

export interface MatchRow {
  id: string;
  stage: string;
  user_a: string;
  user_b: string;
}

export const chatService = {
  /** The match row (RLS: participant only) — for stage + participant checks. */
  async getMatch(matchId: string): Promise<MatchRow | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('matches')
      .select('id, stage, user_a, user_b')
      .eq('id', matchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return (data as MatchRow) ?? null;
  },

  /** The conversation for a match (may not exist until the first message). */
  async getConversationId(matchId: string): Promise<string | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('conversations')
      .select('id')
      .eq('match_id', matchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  },

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, type, body, created_at')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  },

  /** Sender's introduction quota used in this conversation (0 if none yet). */
  async getSentCount(conversationId: string, userId: string): Promise<number> {
    const supabase = requireSupabaseClient();
    const { data } = await supabase
      .from('message_counters')
      .select('sent_count')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    return data?.sent_count ?? 0;
  },

  async sendText(matchId: string, body: string): Promise<SendResult> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('send-text-message', { body: { matchId, body } });
    if (error) throw error;
    return data as SendResult;
  },

  /** Journey state for this match: next stage, both consents, unmet requirements. */
  async getStageStatus(matchId: string): Promise<StageStatus> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('stage-transition', { body: { action: 'status', matchId } });
    if (error) throw error;
    return data as StageStatus;
  },

  /** Consent to (or withdraw consent from) the next stage. Advances only when mutual. */
  async setStageConsent(matchId: string, consent: boolean): Promise<StageStatus> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('stage-transition', {
      body: { action: consent ? 'consent' : 'withdraw', matchId },
    });
    if (error) throw error;
    return data as StageStatus;
  },

  async endConnection(matchId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.functions.invoke('stage-transition', { body: { action: 'terminate', matchId } });
    if (error) throw error;
  },
};
