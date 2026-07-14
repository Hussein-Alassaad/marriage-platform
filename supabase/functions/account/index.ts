// Edge Function: account
//
// Data export and account deletion. These are not features — they are obligations, and a
// platform that holds someone's identity documents and private conversations has no
// business shipping without them.
//
// EXPORT gives the member everything the platform holds *about them* and nothing about
// anybody else. Their messages are included; the other person's replies are NOT — a data
// export must not become a way to walk off with someone else's words.
//
// DELETE is a real deletion of the things that identify them, not a hidden flag:
//   • identity documents are removed from storage immediately (they are the most sensitive
//     thing we hold, and the one thing nobody should have to ask twice about);
//   • the profile is anonymised and soft-deleted, which breaks discovery, matching and
//     every join that would surface them;
//   • their matches are terminated, so the other side is not left talking to a ghost;
//   • the auth user is deleted, so they cannot log back in.
// What survives: audit logs and payment records, which exist precisely so that "who
// approved this payment" survives the account. They no longer point at a person.
//
// Actions: export | delete
//
// Deploy: `supabase functions deploy account`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  const email = userData.user?.email ?? null;
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'export') {
      const own = (table: string, columns: string, column = 'user_id') =>
        admin.from(table).select(columns).eq(column, uid);

      const [profile, verifications, subscriptions, payments, claims, income, expenses, budgets, goals, notifications, assistantChats, memory] =
        await Promise.all([
          admin.from('profiles').select('*').eq('id', uid).maybeSingle(),
          own('identity_verifications', 'status, document_type, submitted_at, reviewed_at, rejection_reason'),
          own('subscriptions', 'tier, status, started_at, expires_at'),
          own('payments', 'method, amount, currency, status, created_at'),
          own('payment_claims', 'method, reference_code, amount, currency, status, submitted_at'),
          own('income', 'source, amount, currency, occurred_on, recurring'),
          own('expenses', 'category, amount, currency, occurred_on, recurring'),
          own('budgets', 'category, amount, currency, period'),
          own('savings_goals', 'name, target_amount, current_amount, currency, deadline'),
          own('notifications', 'category, type, data, read_at, created_at'),
          own('assistant_chats', 'id, title, created_at'),
          own('assistant_memory', 'key, value, consented, updated_at'),
        ]);

      // Their own assistant messages (both sides of that conversation are theirs).
      const chatIds = ((assistantChats.data ?? []) as { id: string }[]).map((c) => c.id);
      const { data: assistantMessages } = chatIds.length
        ? await admin.from('assistant_messages').select('chat_id, role, content, created_at').in('chat_id', chatIds)
        : { data: [] };

      // Messages THEY sent. The other person's replies are theirs, not this member's, and
      // an export must not become a way to walk off with someone else's words.
      const { data: sentMessages } = await admin
        .from('messages')
        .select('conversation_id, type, body, created_at')
        .eq('sender_id', uid)
        .order('created_at');

      return json({
        exportedAt: new Date().toISOString(),
        account: { id: uid, email },
        profile: profile.data ?? null,
        verifications: verifications.data ?? [],
        subscriptions: subscriptions.data ?? [],
        payments: payments.data ?? [],
        paymentClaims: claims.data ?? [],
        finance: {
          income: income.data ?? [],
          expenses: expenses.data ?? [],
          budgets: budgets.data ?? [],
          savingsGoals: goals.data ?? [],
        },
        notifications: notifications.data ?? [],
        assistant: { chats: assistantChats.data ?? [], messages: assistantMessages ?? [], memory: memory.data ?? [] },
        messagesYouSent: sentMessages ?? [],
        note:
          'This export contains what the platform holds about you. Messages other people sent you are their words, not your data, and are not included.',
      });
    }

    if (action === 'delete') {
      // Deleting an account is irreversible, so it must be deliberate: the client sends
      // back an explicit confirmation rather than a single mis-clicked button.
      if (body.confirm !== true) return json({ error: 'confirmation_required' }, 400);

      const now = new Date().toISOString();

      // 1. Identity documents first — the most sensitive thing we hold. If anything later
      //    in this sequence fails, these are already gone, which is the right order to fail in.
      const { data: verifications } = await admin
        .from('identity_verifications')
        .select('id, document_path, selfie_path')
        .eq('user_id', uid);
      const paths = ((verifications ?? []) as { document_path: string | null; selfie_path: string | null }[])
        .flatMap((v) => [v.document_path, v.selfie_path])
        .filter((p): p is string => Boolean(p));
      if (paths.length) {
        await admin.storage.from('identity-documents').remove(paths);
        await admin
          .from('identity_verifications')
          .update({ document_path: null, selfie_path: null })
          .eq('user_id', uid);
      }

      // 2. Their photos. There is no photos TABLE — they live in a storage folder named
      //    after the user id, so the folder is what we list and remove.
      const { data: photos } = await admin.storage.from('profile-photos').list(uid);
      const photoPaths = ((photos ?? []) as { name: string }[]).map((p) => `${uid}/${p.name}`);
      if (photoPaths.length) await admin.storage.from('profile-photos').remove(photoPaths);

      // 3. End every connection, so nobody is left talking to a ghost.
      const { data: matches } = await admin
        .from('matches')
        .select('id')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .is('deleted_at', null);
      const matchIds = ((matches ?? []) as { id: string }[]).map((m) => m.id);
      if (matchIds.length) {
        await admin
          .from('matches')
          .update({ stage: 'terminated', terminated_at: now, terminated_by: uid, deleted_at: now, deleted_by: uid })
          .in('id', matchIds);
        await admin
          .from('shared_finance')
          .update({ active: false, user_a_consent: false, user_b_consent: false, disconnected_at: now })
          .in('match_id', matchIds);
      }

      // 4. Anonymise and soft-delete the profile. This is what breaks discovery, matching,
      //    and every join that would otherwise surface them.
      await admin
        .from('profiles')
        .update({
          display_name: null,
          legal_first_name: null,
          bio: null,
          occupation: null,
          university: null,
          major: null,
          city: null,
          status: 'banned', // cannot act, even if a session somehow survives
          deleted_at: now,
          deleted_by: uid,
        })
        .eq('id', uid);

      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: 'account.deleted',
        entity_type: 'profile',
        entity_id: uid,
        after: { matches_terminated: matchIds.length, documents_removed: paths.length },
      });

      // 5. The auth user last: once this succeeds they cannot log back in, and every
      //    `on delete cascade` above them fires.
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) return json({ error: error.message }, 400);

      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
