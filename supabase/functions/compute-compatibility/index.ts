// Edge Function: compute-compatibility
// Deterministic, explainable compatibility scoring (no AI key). For the calling
// user it scores eligible candidates from profile data, upserts
// compatibility_scores, and rebuilds today's daily_recommendations (ranked) —
// which `matchmaking.discover` then reads. A scheduled batch can call the same
// logic for all users later; this on-demand action makes it usable today.
//
// Action (JSON): { action: 'refresh' }.
// Deploy: `supabase functions deploy compute-compatibility`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const COLS =
  'id, gender, country, city, languages, marriage_goals, lifestyle, family_values, financial_readiness';

// Ordered scales — adjacency implies partial compatibility.
const SCALES: Record<string, string[]> = {
  religiosity: ['growing', 'moderate', 'practicing'],
  smoking: ['no', 'sometimes', 'yes'],
  involvement: ['independent', 'moderate', 'high'],
  savings: ['early', 'building', 'ready'],
  timeline: ['exploring', 'one_two_years', 'within_year'],
  children: ['prefer_not', 'open', 'want'],
  relocate: ['stay', 'open', 'willing'],
};

function ordinal(scale: string, a?: string, b?: string): number {
  if (!a || !b) return 60;
  const list = SCALES[scale];
  const i = list.indexOf(a);
  const j = list.indexOf(b);
  if (i < 0 || j < 0) return a === b ? 100 : 55;
  const d = Math.abs(i - j);
  return d === 0 ? 100 : d === 1 ? 70 : 45;
}

interface P {
  id: string;
  gender: string | null;
  country: string | null;
  city: string | null;
  languages: string[] | null;
  marriage_goals: Record<string, string> | null;
  lifestyle: Record<string, string> | null;
  family_values: Record<string, string> | null;
  financial_readiness: Record<string, string> | null;
}

function score(me: P, c: P): { overall: number; breakdown: Record<string, number> } {
  const mg = me.marriage_goals ?? {};
  const cg = c.marriage_goals ?? {};
  const ml = me.lifestyle ?? {};
  const cl = c.lifestyle ?? {};

  const religion = ordinal('religiosity', ml.religiosity, cl.religiosity);
  const values = ordinal('involvement', (me.family_values ?? {}).involvement, (c.family_values ?? {}).involvement);
  const goals = Math.round(
    (ordinal('timeline', mg.timeline, cg.timeline) +
      ordinal('children', mg.children, cg.children) +
      ordinal('relocate', mg.relocate, cg.relocate)) /
      3,
  );
  const lifestyle = ordinal('smoking', ml.smoking, cl.smoking);
  const distance = me.city && c.city && me.city === c.city ? 100 : me.country && c.country && me.country === c.country ? 75 : me.country && c.country ? 45 : 60;
  const financial = ordinal('savings', (me.financial_readiness ?? {}).savings, (c.financial_readiness ?? {}).savings);
  const myL = me.languages ?? [];
  const cL = c.languages ?? [];
  const communication = myL.length && cL.length ? (myL.some((l) => cL.includes(l)) ? 100 : 50) : 60;
  const personality = 60; // no signal yet

  const breakdown = { religion, values, goals, lifestyle, distance, financial, communication, personality };
  const overall = Math.round(
    religion * 0.2 +
      values * 0.12 +
      goals * 0.22 +
      lifestyle * 0.1 +
      distance * 0.1 +
      financial * 0.1 +
      communication * 0.1 +
      personality * 0.06,
  );
  return { overall, breakdown };
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

  try {
    const { data: me } = await admin
      .from('profiles')
      .select(`${COLS}, verification_status`)
      .eq('id', uid)
      .maybeSingle();
    if (!me) return json({ error: 'no_profile' }, 400);
    if (me.verification_status !== 'verified') return json({ error: 'not_verified' }, 403);
    if (!me.gender) return json({ error: 'incomplete_profile' }, 400);
    const wanted = me.gender === 'man' ? 'woman' : 'man';

    // Exclusions: self, declined, already-matched counterparts.
    const [{ data: declined }, { data: matched }] = await Promise.all([
      admin.from('declined_profiles').select('candidate_id').eq('user_id', uid),
      admin.from('matches').select('user_a, user_b').or(`user_a.eq.${uid},user_b.eq.${uid}`).is('deleted_at', null),
    ]);
    const exclude = new Set<string>([uid]);
    (declined ?? []).forEach((r: { candidate_id: string }) => exclude.add(r.candidate_id));
    (matched ?? []).forEach((r: { user_a: string; user_b: string }) => exclude.add(r.user_a === uid ? r.user_b : r.user_a));

    const { data: candidates } = await admin
      .from('profiles')
      .select(COLS)
      .is('deleted_at', null)
      .eq('verification_status', 'verified')
      .eq('gender', wanted)
      .limit(200);

    const eligible = ((candidates ?? []) as P[]).filter((c) => !exclude.has(c.id));
    if (eligible.length === 0) return json({ count: 0 });

    const scored = eligible.map((c) => ({ c, ...score(me as P, c) }));
    scored.sort((a, b) => b.overall - a.overall);

    // Upsert compatibility scores.
    await admin.from('compatibility_scores').upsert(
      scored.map((s) => ({
        user_id: uid,
        candidate_id: s.c.id,
        overall: s.overall,
        breakdown: s.breakdown,
        computed_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,candidate_id' },
    );

    // Rebuild today's recommendations (top 20).
    const today = new Date().toISOString().slice(0, 10);
    await admin.from('daily_recommendations').delete().eq('user_id', uid).eq('rec_date', today);
    const top = scored.slice(0, 20);
    await admin
      .from('daily_recommendations')
      .insert(top.map((s, i) => ({ user_id: uid, candidate_id: s.c.id, rec_date: today, rank: i + 1 })));

    return json({ count: top.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
