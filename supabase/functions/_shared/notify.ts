// Emitting a notification event.
//
// A feature never notifies anyone. It emits an event and forgets about it: preferences,
// muted categories, quiet hours and digests are decided in ONE place (the SQL delivery
// trigger, `deliver_notification_event`). Putting that logic here, in each caller, is how
// platforms end up notifying people who asked not to be notified.
//
// Emission is best-effort by design. A failed insert must never fail the action that
// caused it — nobody should lose a payment because the "payment approved" notification
// could not be written. It logs and moves on.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function emit(
  admin: SupabaseClient,
  eventType: string,
  userId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!userId) return;
  const { error } = await admin
    .from('notification_events')
    .insert({ event_type: eventType, user_id: userId, payload });
  if (error) console.error(`notify: ${eventType} failed:`, error.message);
}
