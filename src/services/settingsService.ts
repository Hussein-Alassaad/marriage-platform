import { getSupabaseClient } from '@/lib/supabase';

/** Public (client-readable) platform settings, keyed by setting name. */
export type PublicSettings = Record<string, unknown>;

/**
 * Read public settings from the `settings` table (RLS exposes only is_public
 * rows). Values are stored as JSONB; callers coerce per the known type.
 */
export async function fetchPublicSettings(): Promise<PublicSettings> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.key as string, row.value]));
}

/** Coerce a numeric setting with a fallback (never hardcode limits in features). */
export function settingNumber(settings: PublicSettings, key: string, fallback: number): number {
  const value = settings[key];
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
