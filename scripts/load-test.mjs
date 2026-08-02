#!/usr/bin/env node
/**
 * Minimal load-test tool — no dependency install needed (uses Node's built-in
 * fetch). Fires N concurrent requests at a URL in waves and reports latency
 * percentiles + error rate.
 *
 * Deliberately points at the public `health-check` function by default: it's
 * unauthenticated and does read-only checks, so it's safe to hit repeatedly
 * without risking real load on write paths or skewing any member-facing data.
 * Testing an authenticated/write Edge Function (send-text-message, matchmaking,
 * etc.) needs an explicit decision first — that traffic is indistinguishable
 * from a real spike hitting `payments`/`subscriptions` writes and the DB
 * indexes backing them, on a project with real members. Point TARGET_URL at
 * one of those deliberately, with eyes open, not as a default.
 *
 * Usage:
 *   node scripts/load-test.mjs [concurrency] [totalRequests]
 *   TARGET_URL=https://... node scripts/load-test.mjs 20 200
 */

const TARGET_URL =
  process.env.TARGET_URL ?? 'https://kondapkaroqmoduadopj.supabase.co/functions/v1/health-check';
const concurrency = Number(process.argv[2] ?? 10);
const totalRequests = Number(process.argv[3] ?? 100);

async function timedRequest() {
  const start = performance.now();
  try {
    const res = await fetch(TARGET_URL);
    await res.arrayBuffer(); // drain body so the connection is fully counted
    return { ms: performance.now() - start, status: res.status, ok: res.ok };
  } catch (e) {
    return { ms: performance.now() - start, status: 0, ok: false, error: String(e) };
  }
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`Load testing ${TARGET_URL}`);
  console.log(`concurrency=${concurrency} totalRequests=${totalRequests}\n`);

  const results = [];
  let inFlight = 0;
  let launched = 0;

  await new Promise((resolve) => {
    function launchNext() {
      if (launched >= totalRequests) {
        if (inFlight === 0) resolve();
        return;
      }
      launched++;
      inFlight++;
      timedRequest().then((r) => {
        results.push(r);
        inFlight--;
        launchNext();
      });
    }
    for (let i = 0; i < concurrency; i++) launchNext();
  });

  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok);
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Requests:      ${results.length}`);
  console.log(`Errors:        ${errors.length} (${((errors.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Status counts: ${JSON.stringify(statusCounts)}`);
  console.log(`Latency p50:   ${percentile(latencies, 50).toFixed(0)}ms`);
  console.log(`Latency p90:   ${percentile(latencies, 90).toFixed(0)}ms`);
  console.log(`Latency p99:   ${percentile(latencies, 99).toFixed(0)}ms`);
  console.log(`Latency max:   ${latencies[latencies.length - 1].toFixed(0)}ms`);
}

main();
