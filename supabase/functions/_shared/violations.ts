// Violation escalation ladder (Decisions Part D "Violation handling").
// The ladder itself (2nd violation → warning, 3rd → temporary suspension, severe/
// repeated → admin review) lives entirely in the SQL function `record_violation`
// (20260726150000_violation_escalation_ladder.sql) — this is a thin, shared wrapper
// so every send-*-message function calls it identically.
//
// Call this ONLY when a message was blocked for a real content violation — never
// for `category === 'unavailable'` (the moderator itself failed, not the member's
// fault) or for non-moderation blocks like a quota.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function recordViolation(
  admin: SupabaseClient,
  userId: string,
  category: string,
  moderationId: string | null,
): Promise<void> {
  const { error } = await admin.rpc('record_violation', {
    p_user_id: userId,
    p_category: category,
    p_moderation_id: moderationId,
  });
  // Best-effort, like notification emission: a failure to record a violation must
  // never fail the block itself — the message is already stopped either way.
  if (error) console.error('record_violation_failed', error.message);
}
