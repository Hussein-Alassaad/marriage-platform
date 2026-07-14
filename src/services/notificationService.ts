import { requireSupabaseClient } from '@/lib/supabase';

/**
 * Notifications are WRITTEN only by the delivery trigger (service role) — a client that
 * could insert one could forge a message from the platform itself. A member may read
 * their own, mark them read, and soft-delete them; that is the whole of the client's
 * write surface, and RLS enforces it.
 *
 * A row stores `type` + `data`, not a rendered sentence, so the UI can render it through
 * i18n in whatever language the member is reading in *today*.
 */

export interface AppNotification {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type DigestMode = 'immediate' | 'daily' | 'weekly' | 'none';

export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00"
  end: string; // "07:00"
  tz: string;
}

export interface NotificationPrefs {
  channels: Record<string, boolean>;
  quiet_hours: Partial<QuietHours>;
  digest_mode: DigestMode;
  /** category → enabled. A missing key means enabled (opt-out, not opt-in). */
  categories: Record<string, boolean>;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  channels: { in_app: true, email: false, sms: false, whatsapp: false, push: false },
  quiet_hours: { enabled: false, start: '22:00', end: '07:00', tz: 'UTC' },
  digest_mode: 'immediate',
  categories: {},
};

export const CATEGORIES = [
  'match',
  'chat',
  'family',
  'subscription',
  'verification',
  'finance',
  'system',
] as const;

export const notificationService = {
  async list(userId: string, limit = 50): Promise<AppNotification[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, category, type, title, body, data, read_at, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AppNotification[];
  },

  async unreadCount(userId: string): Promise<number> {
    const supabase = requireSupabaseClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('deleted_at', null);
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('deleted_at', null);
    if (error) throw error;
  },

  /** Soft delete — the row stays for audit, the member stops seeing it. */
  async dismiss(id: string, userId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('notifications')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id);
    if (error) throw error;
  },

  async getPrefs(userId: string): Promise<NotificationPrefs> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('channels, quiet_hours, digest_mode, categories')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_PREFS;
    return {
      channels: { ...DEFAULT_PREFS.channels, ...(data.channels ?? {}) },
      quiet_hours: { ...DEFAULT_PREFS.quiet_hours, ...(data.quiet_hours ?? {}) },
      digest_mode: (data.digest_mode ?? 'immediate') as DigestMode,
      categories: data.categories ?? {},
    };
  },

  /** Preferences are the member's own row — RLS allows this write, and only theirs. */
  async savePrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' });
    if (error) throw error;
  },
};
