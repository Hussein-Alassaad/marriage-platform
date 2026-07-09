import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Thin, typed access points to the Supabase capabilities the platform relies on.
 * Components never touch the Supabase client directly (Handbook §1.6); they go
 * through domain services, which in turn use these accessors.
 *
 * Phase 1 wires Auth, Storage, Realtime, and Edge Functions. The concrete domain
 * services (authService, matchService, chatService, …) are added in their phases.
 */

export { isSupabaseConfigured };

/** Auth API (sign-up/in, session, phone OTP) — used by authService in Phase 3. */
export function getAuth() {
  return getSupabaseClient()?.auth ?? null;
}

/** Storage API (private buckets, signed URLs) — used from Phase 4 onward. */
export function getStorage() {
  return getSupabaseClient()?.storage ?? null;
}

/**
 * Realtime channel factory (chat, notifications). Returns `null` until the
 * backend is configured. Callers must unsubscribe on cleanup.
 */
export function createRealtimeChannel(name: string) {
  return getSupabaseClient()?.channel(name) ?? null;
}

/**
 * Invoke a Supabase Edge Function. Every business-rule operation
 * (send-text-message, send-interest, stage-transition, ai-gateway,
 * payment-webhook, …) routes through an Edge Function — the frontend never
 * performs those writes directly.
 */
export async function invokeEdgeFunction<TResponse>(
  name: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
    );
  }
  const { data, error } = await supabase.functions.invoke<TResponse>(name, { body });
  if (error) throw error;
  return data as TResponse;
}
