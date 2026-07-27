// Edge Function: health-check
//
// A PUBLIC, unauthenticated version of the `admin` function's `health` action —
// built for external uptime monitors (Sentry/UptimeRobot/etc.), which cannot log
// in as an admin. It runs the exact same checks (`_shared/health.ts`), so the
// dashboard and an outside monitor can never disagree about what "healthy" means.
//
// Deliberately reveals nothing private: the checks are operational booleans and
// short status strings ("stale: exchange_rates_fetch", "3 verifications waiting")
// — never a member's data, never a count of anything a client couldn't already
// infer from public settings.
//
// Returns HTTP 200 when healthy, 503 when not — so a monitor configured to expect
// "success" needs no JSON parsing to alert correctly.
//
// Point an uptime monitor at this URL, checking every few minutes:
//   https://<project-ref>.supabase.co/functions/v1/health-check
//
// Deploy: `supabase functions deploy health-check --no-verify-jwt`
// (--no-verify-jwt is required — Supabase otherwise demands a Authorization
// header before the function body even runs, which an external monitor can't
// provide.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runHealthChecks } from '../_shared/health.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);

    const result = await runHealthChecks(admin);
    return new Response(JSON.stringify(result), {
      status: result.healthy ? 200 : 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // A crashed health check IS an unhealthy signal — never let this endpoint
    // itself throw a raw 500 with no body for the monitor to show you.
    return new Response(
      JSON.stringify({ healthy: false, error: e instanceof Error ? e.message : 'unexpected_error' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
