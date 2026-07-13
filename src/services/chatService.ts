import { requireSupabaseClient } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  sender_id: string;
  type: string;
  body: string | null;
  /** Voice: the moderated transcript. It is what the moderator actually judged. */
  transcript: string | null;
  media_path: string | null;
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

/** Shared multipart path for voice/image/video. A non-2xx carries its reason in the body. */
async function sendMedia(fn: string, matchId: string, field: string, file: Blob, extra?: Record<string, string>) {
  const supabase = requireSupabaseClient();
  const form = new FormData();
  form.append('matchId', matchId);
  Object.entries(extra ?? {}).forEach(([k, v]) => form.append(k, v));
  form.append(field, file, file instanceof File ? file.name : `${field}.bin`);
  const { data, error } = await supabase.functions.invoke(fn, { body: form });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    if (detail?.error) throw new Error(detail.error);
    throw error;
  }
  return data as SendResult;
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
      .select('id, sender_id, type, body, transcript, media_path, created_at')
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

  /**
   * Send a voice note. The server transcribes it, moderates the transcript, and only
   * then stores the audio — so a blocked note never reaches the other person, and
   * nothing is stored when transcription is unavailable.
   */
  async sendVoice(matchId: string, audio: Blob, durationMs: number): Promise<SendResult> {
    return sendMedia('send-voice-message', matchId, 'audio', audio, {
      durationMs: String(Math.round(durationMs)),
    });
  },

  /** Family stage: an image, moderated by the AI before it is ever stored. */
  async sendImage(matchId: string, image: File): Promise<SendResult> {
    return sendMedia('send-image-message', matchId, 'image', image);
  },

  /**
   * AI-suggested things to say next, grounded in both profiles and what has already
   * been said. Returns [] when the AI is unavailable — the caller shows a curated
   * fallback rather than an error, because a suggestion is a convenience, not a gate.
   */
  async getSuggestions(matchId: string, locale: string): Promise<string[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('suggest-questions', {
      body: { matchId, locale },
    });
    if (error) return [];
    return (data?.suggestions ?? []) as string[];
  },

  /** A short-lived signed URL for one media message (participants only). */
  async getMediaUrl(messageId: string): Promise<string> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('chat-media', { body: { messageId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.url as string;
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
