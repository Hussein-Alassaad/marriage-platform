// Edge Function: guardian
// The wali/family system. A guardian never browses the platform — they see only
// the connections the woman explicitly shares with them (Decisions §9 + Part D §3).
//
// Actions (JSON body):
//   invite        — the woman invites a guardian; returns a one-time invite code.
//   accept        — the invited person redeems the code: creates the guardian link
//                   (declared by her, confirmed by them) and grants the `guardian` role.
//   grant-access  — the woman shares ONE connection with her guardian.
//   revoke-access — she takes that access back, at any time.
//   my-guardians  — her guardians + open invitations + which matches are shared.
//   shared-matches— the guardian's view: only the connections shared with them.
//
// The platform never claims to have verified the real family relationship: the
// relationship is *declared* by her and *confirmed* by them, and the UI says so.
//
// Deploy: `supabase functions deploy guardian`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emit } from '../_shared/notify.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const RELATIONSHIPS = new Set(['father', 'mother', 'brother', 'uncle', 'wali', 'other']);

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    if (action === 'invite') {
      const relationship = String(body.relationship ?? '');
      if (!RELATIONSHIPS.has(relationship)) return json({ error: 'bad_relationship' }, 400);

      // Only the woman invites a guardian (Decisions §9).
      const { data: me } = await admin.from('profiles').select('gender').eq('id', uid).maybeSingle();
      if (me?.gender !== 'woman') return json({ error: 'not_eligible' }, 403);

      // One open invitation at a time — a second code would just confuse everyone.
      const { data: open } = await admin
        .from('guardian_invitations')
        .select('id')
        .eq('inviter_id', uid)
        .eq('status', 'pending')
        .limit(1);
      if (open?.length) return json({ error: 'invitation_already_open' }, 409);

      const days = Number(await setting(admin, 'guardian_invite_expiry_days', 14)) || 14;
      const { data: invite, error } = await admin
        .from('guardian_invitations')
        .insert({
          inviter_id: uid,
          relationship,
          guardian_name: body.name ? String(body.name).slice(0, 120) : null,
          guardian_email: body.email ? String(body.email).slice(0, 200) : null,
          guardian_phone: body.phone ? String(body.phone).slice(0, 40) : null,
          note: body.note ? String(body.note).slice(0, 300) : null,
          expires_at: new Date(Date.now() + days * 864e5).toISOString(),
        })
        .select('id, invite_code, relationship, guardian_name, status, expires_at, created_at')
        .single();
      if (error) return json({ error: error.message }, 400);
      // Delivery (email/SMS) lands with the notification service; until then she
      // shares the code herself, which is also the most private option.
      return json({ invitation: invite });
    }

    if (action === 'accept') {
      const code = String(body.code ?? '').trim().toLowerCase();
      if (!code) return json({ error: 'code_required' }, 400);

      const { data: invite } = await admin
        .from('guardian_invitations')
        .select('id, inviter_id, relationship, status, expires_at')
        .eq('invite_code', code)
        .maybeSingle();
      if (!invite || invite.status !== 'pending') return json({ error: 'invalid_code' }, 404);
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await admin.from('guardian_invitations').update({ status: 'expired' }).eq('id', invite.id);
        return json({ error: 'code_expired' }, 410);
      }
      if (invite.inviter_id === uid) return json({ error: 'cannot_guard_yourself' }, 400);
      if (body.confirmed !== true) return json({ error: 'declaration_required' }, 400);

      const now = new Date().toISOString();
      // declared = she named the relationship; confirmed = they accepted it.
      const { error: gErr } = await admin.from('guardians').upsert(
        {
          guardian_user_id: uid,
          ward_id: invite.inviter_id,
          relationship: invite.relationship,
          declared: true,
          confirmed: true,
          deleted_at: null,
        },
        { onConflict: 'guardian_user_id,ward_id' },
      );
      if (gErr) return json({ error: gErr.message }, 400);

      await admin.from('user_roles').upsert({ user_id: uid, role: 'guardian' }, { onConflict: 'user_id,role' });
      await admin
        .from('guardian_invitations')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', invite.id);
      await admin.from('audit_logs').insert({
        actor_id: uid,
        action: 'guardian.accepted',
        entity_type: 'guardian_invitation',
        entity_id: invite.id,
        after: { ward_id: invite.inviter_id, relationship: invite.relationship },
      });

      await emit(admin, 'guardian.accepted', invite.inviter_id, { guardianUserId: uid });

      return json({ ok: true, wardId: invite.inviter_id, relationship: invite.relationship });
    }

    if (action === 'grant-access' || action === 'revoke-access') {
      const matchId = String(body.matchId ?? '');
      const guardianUserId = String(body.guardianUserId ?? '');
      if (!matchId || !guardianUserId) return json({ error: 'bad_request' }, 400);

      // Only a participant of the match may share it, and only with her own guardian.
      const { data: match } = await admin
        .from('matches')
        .select('id, user_a, user_b, deleted_at')
        .eq('id', matchId)
        .maybeSingle();
      if (!match || match.deleted_at || (match.user_a !== uid && match.user_b !== uid)) {
        return json({ error: 'not_a_participant' }, 403);
      }
      const { data: link } = await admin
        .from('guardians')
        .select('id')
        .eq('guardian_user_id', guardianUserId)
        .eq('ward_id', uid)
        .eq('confirmed', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (!link) return json({ error: 'not_your_guardian' }, 403);

      if (action === 'revoke-access') {
        await admin
          .from('guardian_access')
          .update({ revoked_at: new Date().toISOString() })
          .eq('match_id', matchId)
          .eq('guardian_user_id', guardianUserId);
        return json({ ok: true, granted: false });
      }

      await admin.from('guardian_access').upsert(
        { guardian_user_id: guardianUserId, match_id: matchId, granted_by: uid, revoked_at: null },
        { onConflict: 'guardian_user_id,match_id' },
      );
      await emit(admin, 'guardian.access_granted', guardianUserId, { matchId });
      return json({ ok: true, granted: true });
    }

    if (action === 'my-guardians') {
      const [{ data: guardians }, { data: invitations }, { data: access }] = await Promise.all([
        admin
          .from('guardians')
          .select('guardian_user_id, relationship, confirmed, created_at')
          .eq('ward_id', uid)
          .is('deleted_at', null),
        admin
          .from('guardian_invitations')
          .select('id, invite_code, relationship, guardian_name, status, expires_at, created_at')
          .eq('inviter_id', uid)
          .eq('status', 'pending'),
        admin.from('guardian_access').select('guardian_user_id, match_id').eq('granted_by', uid).is('revoked_at', null),
      ]);

      const ids = (guardians ?? []).map((g: { guardian_user_id: string }) => g.guardian_user_id);
      const { data: profs } = await admin.from('profiles').select('id, display_name').in('id', ids);
      const nameById = new Map(
        ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
      );

      return json({
        guardians: (guardians ?? []).map((g: { guardian_user_id: string; relationship: string; confirmed: boolean; created_at: string }) => ({
          userId: g.guardian_user_id,
          displayName: nameById.get(g.guardian_user_id) ?? null,
          relationship: g.relationship,
          confirmed: g.confirmed,
          createdAt: g.created_at,
        })),
        invitation: (invitations ?? [])[0] ?? null,
        sharedMatches: (access ?? []).map((a: { guardian_user_id: string; match_id: string }) => ({
          guardianUserId: a.guardian_user_id,
          matchId: a.match_id,
        })),
      });
    }

    if (action === 'shared-matches') {
      // The guardian's whole world: only what was explicitly shared with them.
      const { data: access } = await admin
        .from('guardian_access')
        .select('match_id, granted_by, created_at')
        .eq('guardian_user_id', uid)
        .is('revoked_at', null);
      const matchIds = (access ?? []).map((a: { match_id: string }) => a.match_id);
      if (!matchIds.length) return json({ matches: [] });

      const { data: matches } = await admin
        .from('matches')
        .select('id, user_a, user_b, stage, created_at')
        .in('id', matchIds)
        .is('deleted_at', null);

      const userIds = new Set<string>();
      (matches ?? []).forEach((m: { user_a: string; user_b: string }) => {
        userIds.add(m.user_a);
        userIds.add(m.user_b);
      });
      const { data: profs } = await admin
        .from('profiles')
        .select('id, display_name, dob, country, city, occupation, education_level')
        .in('id', [...userIds]);
      const byId = new Map(((profs ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));

      const grantedBy = new Map(
        (access ?? []).map((a: { match_id: string; granted_by: string }) => [a.match_id, a.granted_by]),
      );

      return json({
        matches: (matches ?? []).map((m: { id: string; user_a: string; user_b: string; stage: string; created_at: string }) => {
          const wardId = grantedBy.get(m.id);
          const otherId = m.user_a === wardId ? m.user_b : m.user_a;
          return {
            id: m.id,
            stage: m.stage,
            createdAt: m.created_at,
            ward: byId.get(String(wardId)) ?? null,
            candidate: byId.get(otherId) ?? null,
          };
        }),
      });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
