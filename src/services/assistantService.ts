import { requireSupabaseClient } from '@/lib/supabase';

/**
 * The assistant reads only the member's OWN data. It has never been given the other
 * person's profile, messages, or finances — so "what did she say about children?" fails
 * because the information was never in the context, not because a prompt asked it to
 * decline. A refusal you can argue with is not a boundary.
 *
 * Chats are the most private rows on the platform: no admin policy exists on these tables.
 * Writes go through the Edge Function (so the daily limit cannot be bypassed), but DELETE
 * is a direct client call on purpose — erasing your own history must not need the server's
 * permission.
 */

export interface Chat {
  id: string;
  title: string | null;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ChatList {
  chats: Chat[];
  /** 0 means unlimited. */
  limit: number;
  usedToday: number;
  /** False when there is no funded API key, or an admin has switched it off. */
  enabled: boolean;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: unknown;
  consented: boolean;
  updated_at: string;
}

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: { action, ...extra },
  });
  if (error) {
    // A non-2xx carries its reason in the body — surface that, not "Edge Function failed".
    const detail = await error.context?.json?.().catch(() => null);
    if (detail?.error) throw new Error(detail.error);
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const assistantService = {
  listChats: () => call<ChatList>('chats'),
  listMessages: (chatId: string) =>
    call<{ messages: ChatMessage[] }>('messages', { chatId }).then((r) => r.messages),
  send: (text: string, locale: string, chatId?: string) =>
    call<{ chatId: string; message: ChatMessage }>('send', { text, locale, chatId }),

  /** Deleting a chat cascades its messages. No server round-trip: this is the member's row. */
  async deleteChat(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('assistant_chats').delete().eq('id', id);
    if (error) throw error;
  },

  async listMemory(userId: string): Promise<MemoryItem[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('assistant_memory')
      .select('id, key, value, consented, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as MemoryItem[];
  },

  async forget(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('assistant_memory').delete().eq('id', id);
    if (error) throw error;
  },

  async forgetAll(userId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('assistant_memory').delete().eq('user_id', userId);
    if (error) throw error;
  },
};
