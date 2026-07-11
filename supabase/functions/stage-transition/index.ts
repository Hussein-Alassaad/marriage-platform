// Edge Function: stage-transition
// The ONLY writer of matches.stage. A match advances when BOTH participants have
// consented to the same next stage AND that stage's requirements are met
// (Decisions Part D). Clients cannot write matches, stage_history, or stage_consents.
//
// Actions (JSON body):
//   status   — current stage, next stage, both consents, and each requirement's state
//   consent  — record my consent for the next stage; advances the match if now mutual
//   withdraw — remove my consent for the next stage
//   terminate— end the connection (either party), with the settings cooldown
//
// Requirements per Part D:
//   introduction  -> serious_communication : both consent + both paid
//                                            (gate: settings.serious_stage_requires_paid)
//   serious_communication -> family        : both consent + the woman's guardian is
//                                            confirmed and granted access to this match
//   family -> married                      : both confirm they are married
//
// Deploy: `supabase functions deploy stage-transition`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const NEXT: Record<string, string | null> = {
  interest_sent: null, // advanced by accepting the interest (matchmaking)
  introduction: 'serious_communication',
  serious_communication: 'family',
  family: 'married',
  married: null,
  terminated: null,
};

type Requirement = { key: string; met: boolean };

async function setting<T>(admin: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data } = await admin.from('settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

const isPaid = (tier: string | null) => tier === 'serious' || tier === 'marriage_plus';

/** What still has to be true before `next` can be entered. Empty = ready (given mutual consent). */
async function requirements(
  admin: SupabaseClient,
  next: string,
  matchId: string,
  a: { id: string; tier: string | null; gender: string | null },
  b: { id: string; tier: string | null; gender: string | null },
): Promise<Requirement[]> {
  if (next === 'serious_communication') {
    const requiresPaid = await setting(admin, 'serious_stage_requires_paid', true);
    if (!requiresPaid) return [];
    return [
      { key: 'you_paid', met: isPaid(a.tier) },
      { key: 'they_paid', met: isPaid(b.tier) },
    ];
  }

  if (next === 'family') {
    // The woman's guardian must be confirmed AND explicitly granted access to this match.
    const woman = a.gender === 'woman' ? a.id : b.gender === 'woman' ? b.id : null;
    if (!woman) return [{ key: 'guardian_ready', met: false }];
    const { data: guardians } = await admin
      .from('guardians')
      .select('guardian_user_id')
      .eq('ward_id', woman)
      .eq('confirmed', true)
      .is('deleted_at', null);
    const ids = (guardians ?? []).map((g: { guardian_user_id: string }) => g.guardian_user_id);
    if (!ids.length) return [{ key: 'guardian_ready', met: false }];
    const { data: access } = await admin
      .from('guardian_access')
      .select('id')
      .eq('match_id', matchId)
      .in('guardian_user_id', ids)
      .is('revoked_at', null)
      .limit(1);
    return [{ key: 'guardian_ready', met: Boolean(access?.length) }];
  }

  return []; // married: mutual confirmation is the only requirement
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
  const matchId = String(body.matchId ?? '');
  if (!matchId) return json({ error: 'match_required' }, 400);

  try {
    const { data: match } = await admin
      .from('matches')
      .select('id, user_a, user_b, stage, deleted_at')
      .eq('id', matchId)
      .maybeSingle();
    if (!match || match.deleted_at || (match.user_a !== uid && match.user_b !== uid)) {
      return json({ error: 'not_a_participant' }, 403);
    }
    const stage = match.stage as string;
    const otherId = match.user_a === uid ? match.user_b : match.user_a;
    const next = NEXT[stage] ?? null;

    if (action === 'terminate') {
      const days = await setting(admin, 'rerequest_cooldown_days', 30);
      const now = new Date().toISOString();
      const cooldown = new Date(Date.now() + Number(days) * 864e5).toISOString();
      await admin
        .from('matches')
        .update({
          stage: 'terminated',
          terminated_at: now,
          terminated_by: uid,
          cooldown_until: cooldown,
          deleted_at: now,
          deleted_by: uid,
        })
        .eq('id', matchId);
      await admin.from('stage_history').insert({
        match_id: matchId,
        from_stage: stage,
        to_stage: 'terminated',
        changed_by: uid,
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 300) : null,
      });
      return json({ ok: true, stage: 'terminated' });
    }

    // Everything below needs a next stage to exist.
    const buildStatus = async (currentStage: string) => {
      const nextStage = NEXT[currentStage] ?? null;
      if (!nextStage) {
        return { stage: currentStage, next: null, youConsented: false, theyConsented: false, requirements: [] };
      }
      const [{ data: profs }, { data: consents }] = await Promise.all([
        admin.from('profiles').select('id, gender, subscription_tier').in('id', [uid, otherId]),
        admin.from('stage_consents').select('user_id').eq('match_id', matchId).eq('to_stage', nextStage),
      ]);
      const byId = new Map(
        ((profs ?? []) as { id: string; gender: string | null; subscription_tier: string | null }[]).map((p) => [p.id, p]),
      );
      const me = { id: uid, gender: byId.get(uid)?.gender ?? null, tier: byId.get(uid)?.subscription_tier ?? null };
      const them = {
        id: otherId,
        gender: byId.get(otherId)?.gender ?? null,
        tier: byId.get(otherId)?.subscription_tier ?? null,
      };
      const consented = new Set((consents ?? []).map((c: { user_id: string }) => c.user_id));
      const reqs = await requirements(admin, nextStage, matchId, me, them);
      return {
        stage: currentStage,
        next: nextStage,
        youConsented: consented.has(uid),
        theyConsented: consented.has(otherId),
        requirements: reqs,
      };
    };

    if (action === 'status') {
      return json(await buildStatus(stage));
    }

    if (action === 'withdraw') {
      if (!next) return json({ error: 'no_next_stage' }, 409);
      await admin.from('stage_consents').delete().eq('match_id', matchId).eq('user_id', uid).eq('to_stage', next);
      return json(await buildStatus(stage));
    }

    if (action === 'consent') {
      if (!next) return json({ error: 'no_next_stage' }, 409);
      await admin
        .from('stage_consents')
        .upsert({ match_id: matchId, user_id: uid, to_stage: next }, { onConflict: 'match_id,user_id,to_stage' });

      const status = await buildStatus(stage);
      const mutual = status.youConsented && status.theyConsented;
      const ready = status.requirements.every((r) => r.met);
      if (!mutual || !ready) return json({ ...status, advanced: false });

      // Both consented and every requirement is met — advance. The stage column is
      // the single source of truth; stage_history is append-only.
      const { error: uErr } = await admin.from('matches').update({ stage: next }).eq('id', matchId).eq('stage', stage);
      if (uErr) return json({ error: uErr.message }, 400);
      await admin.from('stage_history').insert({
        match_id: matchId,
        from_stage: stage,
        to_stage: next,
        changed_by: uid,
        reason: 'mutual_consent',
      });
      return json({ ...(await buildStatus(next)), advanced: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
