// Edge Function: matchmaking
// Cross-user profile reads are blocked by RLS (own-only), and matches/interests
// are not client-writable — so discovery and the whole interest flow run here
// with the service role, returning only privacy-safe candidate fields.
//
// Actions (JSON body): discover · connections · send-interest · respond-interest.
// Recommendations/compat scores are engine-computed (batch, later). Until that
// runs, discover falls back to a simple verified/opposite-gender query so the
// feature works today.
//
// Deploy: `supabase functions deploy matchmaking`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emit } from '../_shared/notify.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const CANDIDATE_COLS =
  'id, display_name, dob, gender, country, city, education_level, occupation, languages, bio, marriage_goals, photo_privacy_mode, privacy, verification_status, profile_completion';

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  dob: string | null;
  gender: 'man' | 'woman' | null;
  country: string | null;
  city: string | null;
  education_level: string | null;
  occupation: string | null;
  languages: string[] | null;
  bio: string | null;
  marriage_goals: Record<string, string> | null;
  photo_privacy_mode: number | null;
  privacy: { primaryPhoto?: string | null } | null;
}

async function mapCandidate(
  admin: SupabaseClient,
  paid: boolean,
  p: ProfileRow,
  overall: number | null,
  breakdown: Record<string, number> | null,
  saved: boolean,
) {
  let photoUrl: string | null = null;
  let photoLocked = false;
  const primary = p.privacy?.primaryPhoto ?? null;
  const mode = p.photo_privacy_mode ?? 2;
  const canSee = mode === 1 || (paid && mode === 2);
  if (primary && canSee) {
    const { data } = await admin.storage.from('profile-photos').createSignedUrl(primary, 3600);
    photoUrl = data?.signedUrl ?? null;
  } else if (primary) {
    photoLocked = true;
  }
  return {
    id: p.id,
    displayName: p.display_name,
    age: ageFromDob(p.dob),
    country: p.country,
    city: p.city,
    educationLevel: p.education_level,
    occupation: p.occupation,
    languages: p.languages ?? [],
    bio: p.bio ? p.bio.slice(0, 240) : null,
    goals: p.marriage_goals ?? {},
    overall,
    breakdown,
    photoUrl,
    photoLocked,
    saved,
  };
}

/** A suspended or banned member may not act. Checked here, not at login: a session issued
 *  a minute before a suspension must not buy an hour of harassment. */
async function accountActive(admin: SupabaseClient, uid: string): Promise<boolean> {
  const { data } = await admin.rpc('is_account_active', { uid });
  return data === true;
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
  if (!(await accountActive(admin, uid))) return json({ error: 'account_suspended' }, 403);
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // Requester profile (gate + tier + gender).
  const { data: me } = await admin
    .from('profiles')
    .select('gender, subscription_tier, verification_status')
    .eq('id', uid)
    .maybeSingle();
  if (!me) return json({ error: 'no_profile' }, 400);
  const verified = me.verification_status === 'verified';
  const paid = me.subscription_tier === 'serious' || me.subscription_tier === 'marriage_plus';

  try {
    if (action === 'discover') {
      if (!verified) return json({ error: 'not_verified' }, 403);
      if (!me.gender) return json({ candidates: [], paid });
      const wanted = me.gender === 'man' ? 'woman' : 'man';

      // Exclusions: self, declined, already-matched counterparts, already-invited.
      const [{ data: declined }, { data: matched }, { data: sent }] = await Promise.all([
        admin.from('declined_profiles').select('candidate_id').eq('user_id', uid),
        admin.from('matches').select('user_a, user_b').or(`user_a.eq.${uid},user_b.eq.${uid}`).is('deleted_at', null),
        admin.from('interests').select('recipient_id').eq('sender_id', uid),
      ]);
      const exclude = new Set<string>([uid]);
      (declined ?? []).forEach((r: { candidate_id: string }) => exclude.add(r.candidate_id));
      (sent ?? []).forEach((r: { recipient_id: string }) => exclude.add(r.recipient_id));
      (matched ?? []).forEach((r: { user_a: string; user_b: string }) => {
        exclude.add(r.user_a === uid ? r.user_b : r.user_a);
      });

      // Prefer today's engine recommendations; else fall back to a simple query.
      const { data: recs } = await admin
        .from('daily_recommendations')
        .select('candidate_id, rank')
        .eq('user_id', uid)
        .eq('rec_date', new Date().toISOString().slice(0, 10))
        .order('rank', { ascending: true })
        .limit(30);

      let profiles: ProfileRow[] = [];
      if (recs && recs.length) {
        const ids = recs.map((r: { candidate_id: string }) => r.candidate_id).filter((id: string) => !exclude.has(id));
        const { data } = await admin.from('profiles').select(CANDIDATE_COLS).in('id', ids).is('deleted_at', null);
        const byId = new Map((data ?? []).map((p: ProfileRow) => [p.id, p]));
        profiles = ids.map((id: string) => byId.get(id)).filter(Boolean) as ProfileRow[];
      } else {
        const { data } = await admin
          .from('profiles')
          .select(CANDIDATE_COLS)
          .is('deleted_at', null)
          .eq('verification_status', 'verified')
          .eq('gender', wanted)
          .order('profile_completion', { ascending: false })
          .limit(40);
        profiles = ((data ?? []) as ProfileRow[]).filter((p) => !exclude.has(p.id)).slice(0, 24);
      }

      const ids = profiles.map((p) => p.id);
      const [{ data: scores }, { data: savedRows }] = await Promise.all([
        admin.from('compatibility_scores').select('candidate_id, overall, breakdown').eq('user_id', uid).in('candidate_id', ids),
        admin.from('saved_profiles').select('candidate_id').eq('user_id', uid).in('candidate_id', ids),
      ]);
      const scoreBy = new Map((scores ?? []).map((s: { candidate_id: string; overall: number; breakdown: Record<string, number> }) => [s.candidate_id, s]));
      const savedSet = new Set((savedRows ?? []).map((s: { candidate_id: string }) => s.candidate_id));

      const candidates = await Promise.all(
        profiles.map((p) => {
          const s = scoreBy.get(p.id);
          return mapCandidate(admin, paid, p, s?.overall ?? null, s?.breakdown ?? null, savedSet.has(p.id));
        }),
      );
      return json({ candidates, paid });
    }

    if (action === 'connections') {
      const { data: interests } = await admin
        .from('interests')
        .select('id, sender_id, recipient_id, status, note, match_id, created_at')
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order('created_at', { ascending: false });
      const { data: matches } = await admin
        .from('matches')
        .select('id, user_a, user_b, stage, initiated_by, created_at')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .is('deleted_at', null);

      const others = new Set<string>();
      (interests ?? []).forEach((i: { sender_id: string; recipient_id: string }) =>
        others.add(i.sender_id === uid ? i.recipient_id : i.sender_id),
      );
      (matches ?? []).forEach((m: { user_a: string; user_b: string }) =>
        others.add(m.user_a === uid ? m.user_b : m.user_a),
      );
      const { data: profs } = await admin.from('profiles').select(CANDIDATE_COLS).in('id', [...others]);
      const profById = new Map(((profs ?? []) as ProfileRow[]).map((p) => [p.id, p]));
      const card = async (otherId: string) => {
        const p = profById.get(otherId);
        return p ? await mapCandidate(admin, paid, p, null, null, false) : null;
      };

      const incoming = [];
      const outgoing = [];
      for (const i of interests ?? []) {
        const otherId = i.sender_id === uid ? i.recipient_id : i.sender_id;
        const entry = { id: i.id, status: i.status, note: i.note, createdAt: i.created_at, person: await card(otherId) };
        if (i.recipient_id === uid) incoming.push(entry);
        else outgoing.push(entry);
      }
      const matchCards = [];
      for (const m of matches ?? []) {
        const otherId = m.user_a === uid ? m.user_b : m.user_a;
        matchCards.push({ id: m.id, stage: m.stage, createdAt: m.created_at, person: await card(otherId) });
      }
      return json({ incoming, outgoing, matches: matchCards });
    }

    if (action === 'send-interest') {
      if (!verified) return json({ error: 'not_verified' }, 403);
      const recipientId = String(body.recipientId ?? '');
      const note = body.note ? String(body.note).slice(0, 300) : null;
      if (!recipientId || recipientId === uid) return json({ error: 'bad_recipient' }, 400);
      const { data: rp } = await admin.from('profiles').select('verification_status').eq('id', recipientId).maybeSingle();
      if (!rp || rp.verification_status !== 'verified') return json({ error: 'recipient_unavailable' }, 400);

      const [a, b] = [uid, recipientId].sort();
      const { data: existing } = await admin
        .from('matches')
        .select('id')
        .eq('user_a', a)
        .eq('user_b', b)
        .is('deleted_at', null)
        .maybeSingle();
      if (existing) return json({ error: 'already_connected' }, 409);

      const { data: match, error: mErr } = await admin
        .from('matches')
        .insert({ user_a: a, user_b: b, stage: 'interest_sent', initiated_by: uid })
        .select('id')
        .single();
      if (mErr) return json({ error: mErr.message }, 400);
      const { error: iErr } = await admin
        .from('interests')
        .insert({ sender_id: uid, recipient_id: recipientId, status: 'sent', note, match_id: match.id });
      if (iErr) return json({ error: iErr.message }, 400);
      await admin.from('stage_history').insert({ match_id: match.id, from_stage: null, to_stage: 'interest_sent', changed_by: uid });
      await emit(admin, 'interest.received', recipientId, { matchId: match.id });
      return json({ ok: true });
    }

    if (action === 'respond-interest') {
      const interestId = String(body.interestId ?? '');
      const decision = String(body.decision ?? '');
      if (decision !== 'accepted' && decision !== 'declined') return json({ error: 'bad_decision' }, 400);
      const { data: interest } = await admin
        .from('interests')
        .select('id, sender_id, recipient_id, status, match_id')
        .eq('id', interestId)
        .maybeSingle();
      if (!interest || interest.recipient_id !== uid || interest.status !== 'sent') return json({ error: 'not_actionable' }, 400);

      const senderId = interest.sender_id as string;
      await admin.from('interests').update({ status: decision, responded_at: new Date().toISOString() }).eq('id', interestId);
      if (interest.match_id) {
        if (decision === 'accepted') {
          await admin.from('matches').update({ stage: 'introduction' }).eq('id', interest.match_id);
          await admin.from('stage_history').insert({ match_id: interest.match_id, from_stage: 'interest_sent', to_stage: 'introduction', changed_by: uid });
          // The sender is the one waiting on an answer — they are who we tell.
          await emit(admin, 'interest.accepted', senderId, { matchId: interest.match_id });
        } else {
          const cooldown = new Date(Date.now() + 30 * 864e5).toISOString();
          await admin.from('matches').update({ stage: 'terminated', terminated_at: new Date().toISOString(), terminated_by: uid, cooldown_until: cooldown, deleted_at: new Date().toISOString(), deleted_by: uid }).eq('id', interest.match_id);
          await admin.from('stage_history').insert({ match_id: interest.match_id, from_stage: 'interest_sent', to_stage: 'terminated', changed_by: uid });
          await emit(admin, 'interest.declined', senderId, { matchId: interest.match_id });
        }
      }
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
