// Edge Function: compute-compatibility
// On-demand trigger for the calling user's compatibility scores + today's
// daily_recommendations. The scoring itself (weights, ordinal scales,
// distance/communication rules) lives in one place — the SQL function
// `compute_compatibility_for_user`, added in
// supabase/migrations/20260725100000_daily_match_generation.sql — so this
// button and the nightly `daily_match_generation` cron job can never disagree.
// Per-tier daily counts (`daily_recs_free`/`_serious`/`_marriage_plus`) and the
// Marriage Plus refresh (`plus_refresh_per_day`, genuinely different profiles via
// `served_recommendations`) were wired in
// supabase/migrations/20260726110000_tiered_recommendations.sql.
//
// Actions (JSON): { action: 'refresh' } (everyone) · { action: 'refresh_plus' }
// (Marriage Plus only, rate-limited).
// Deploy: `supabase functions deploy compute-compatibility`.

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
  if (!uid) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'refresh');

  try {
    if (action === 'refresh_plus') {
      const { data, error } = await admin.rpc('refresh_recommendations_for_user', { p_user_id: uid });
      if (error) return json({ error: error.message }, 500);

      const result = data as string;
      const [{ data: counter }, { data: setting }] = await Promise.all([
        admin
          .from('recommendation_refresh_counters')
          .select('count')
          .eq('user_id', uid)
          .eq('day', new Date().toISOString().slice(0, 10))
          .maybeSingle(),
        admin.from('settings').select('value').eq('key', 'plus_refresh_per_day').maybeSingle(),
      ]);
      const used = counter?.count ?? 0;
      const limit = Number(setting?.value ?? 3);

      if (result === 'skipped: tier_required') return json({ error: 'tier_required' }, 403);
      if (result === 'skipped: no_profile') return json({ error: 'no_profile' }, 400);
      if (result.startsWith('skipped: refresh_limit_reached')) {
        return json({ error: 'refresh_limit_reached', used, limit }, 429);
      }

      const match = /^ok: (\d+)$/.exec(result);
      if (!match) return json({ error: 'unexpected_result' }, 500);
      return json({ count: Number(match[1]), used, limit });
    }

    const { data, error } = await admin.rpc('compute_compatibility_for_user', { p_user_id: uid });
    if (error) return json({ error: error.message }, 500);

    const result = data as string;
    if (result === 'skipped: no_profile') return json({ error: 'no_profile' }, 400);
    if (result === 'skipped: not_verified') return json({ error: 'not_verified' }, 403);
    if (result === 'skipped: incomplete_profile') return json({ error: 'incomplete_profile' }, 400);

    const match = /^ok: (\d+)$/.exec(result);
    if (!match) return json({ error: 'unexpected_result' }, 500);
    return json({ count: Number(match[1]) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
