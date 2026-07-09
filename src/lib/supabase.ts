import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * Whether the Supabase environment is configured for this build.
 * Phase 1 ships the wiring; the dev/staging/prod projects and their keys are
 * provided per environment via `.env`. Until then, the app runs as a shell.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * The shared Supabase browser client, or `null` if the environment is not yet
 * configured. The frontend only ever uses the public anon key and only reaches
 * Supabase through RLS-protected reads and Edge Functions — never with any
 * elevated secret.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/**
 * Same as {@link getSupabaseClient} but throws when unconfigured. Use in code
 * paths that cannot meaningfully proceed without a backend (later phases).
 */
export function requireSupabaseClient(): SupabaseClient {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
    );
  }
  return supabase;
}
