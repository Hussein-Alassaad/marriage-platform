# Runbook — Mithaq

What to do when something breaks, and how to get the platform back. Written to be read at
2am by someone who did not build it.

---

## 1. The silent failures (check these first)

These are the failures that produce **no error anywhere**. The Admin → Overview page checks
all four automatically and shows a red strip when any is unhealthy.

| Symptom | Almost certainly | Fix |
|---|---|---|
| **Every message is blocked** with "Safety review is temporarily unavailable" | `moderation_ai_enabled` is **true** but `ANTHROPIC_API_KEY` is missing, invalid, or unfunded. Moderation fails **closed**, so a broken key blocks the entire platform. | Either fund/replace the key (`supabase secrets set ANTHROPIC_API_KEY=…`) **or** set `moderation_ai_enabled` to `false` in Admin → Settings. The key-free pre-filter then becomes the only moderator — weaker, but the platform runs. |
| **Finance figures look wrong** for LBP users | Exchange rates are stale. This does not error; it just quietly converts at last week's rate. | Admin → Jobs → run `exchange_rates_fetch`, wait a minute, then `exchange_rates_collect`. Check `exchange_rates.as_of`. |
| **Nobody is getting notified** | The delivery trigger is fine (it is SQL), but events may be held. | Admin → Jobs → run `notification_flush`. If events pile up with `processed_at` null, check `notification_preferences` for a quiet-hours window that never ends. |
| **Members stuck unverified** | Nobody is working the queue. Verification gates matchmaking, so this stops the platform at its front door. | Admin → Verification. |
| **A job has been failing for days** | `scheduled_jobs.last_result` starts with `error:`. | Admin → Jobs shows the error verbatim. Re-run it there after fixing. |

**The moderation one is the dangerous one.** "AI on, key gone" is worse than "AI off",
because it fails closed and takes the whole platform with it. If members report that
*nothing* sends, check this before anything else.

---

## 2. Backups and recovery

### What must survive
- **Postgres** — everything. Supabase PITR (Point-in-Time Recovery) covers this on paid
  plans; turn it on for production.
- **Storage** — `profile-photos`, `payment-receipts`, `chat-voice`, `chat-images`.
- **NOT `identity-documents`** — deliberately excluded from long-term backup. Decision #15
  says these are deleted after verification; a backup that resurrects them defeats the
  promise we made to members.

### Taking a manual dump

```bash
supabase db dump -f backup-$(date +%F).sql --linked
```

Store it somewhere that is not the same cloud account as the database.

### Restoring

1. **Stop writes.** Set `moderation_ai_enabled=false` and disable jobs in Admin → Jobs, or
   pause the project. A restore racing live traffic produces a database that is neither.
2. Restore the dump into a **fresh** project first, never over the top of a live one:
   ```bash
   supabase db reset --linked   # DESTRUCTIVE — only on the fresh project
   psql "$DATABASE_URL" -f backup-YYYY-MM-DD.sql
   ```
3. **Verify before switching over.** Run the integrity checks below.
4. Re-point the frontend env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and re-set the
   Edge Function secrets — they do **not** come across in a database dump.

### Integrity checks after any restore

```sql
-- Nobody should be mid-journey with no conversation.
select count(*) from matches m
where m.stage not in ('interest_sent','terminated') and m.deleted_at is null
  and not exists (select 1 from conversations c where c.match_id = m.id);

-- Every delivered message must have a moderation verdict. A message with none was
-- inserted around the gate, which should be impossible.
select count(*) from messages msg
where not exists (select 1 from message_moderation mm where mm.message_id = msg.id);

-- Active subscriptions whose tier does not match the profile flag every gate reads.
select count(*) from subscriptions s join profiles p on p.id = s.user_id
where s.status = 'active' and p.subscription_tier <> s.tier::text;

-- Shared finance active on a match that is not married. Must be zero.
select count(*) from shared_finance sf join matches m on m.id = sf.match_id
where sf.active and m.stage <> 'married';
```

All four must return **0**. If any does not, do not switch traffic over.

**Rehearse this on staging before you need it.** A restore procedure nobody has run is a
hope, not a plan.

---

## 3. Incidents

### Someone is being harassed
1. Admin → Users → find them → **Suspend** or **Ban**, with a reason.
2. It bites immediately: the Edge Functions check `is_account_active` before every message
   and every interest. An existing session buys them nothing.
3. The action is in the audit log with your name on it.

### A payment was approved by mistake
Do not edit the tables. Reverse it the way it was made: Admin → Users → the member's tier,
and record why in the audit trail. Payments are append-only on purpose.

### A member asks for their data, or asks to be forgotten
They can do both themselves: **Settings → Download your data** / **Delete your account**.
Deletion erases identity documents immediately, anonymises the profile, and ends their
connections. Point them there rather than doing it for them — self-service is the promise.

### The Anthropic key leaked
Revoke it at console.anthropic.com immediately, then:
```bash
supabase secrets set ANTHROPIC_API_KEY=<new key>
```
No redeploy is needed — functions read the secret at invocation.

---

## 4. Deploying

```bash
cd marriage-platform            # the NESTED folder — the outer one has no functions
npm run typecheck && npm run lint && npm test && npm run build
supabase db push
supabase functions deploy <name>
```

Migrations are forward-only. There is no down-migration: to undo, write a new migration
that reverses the change, so the history stays honest about what actually happened.

---

## 5. What is NOT monitored yet

Being explicit, because a gap you know about is manageable and one you have forgotten is not:

- **No external alerting.** Nothing pages you at 3am. The health strip only shows a problem
  to an admin who is already looking at the dashboard. Set `VITE_ERROR_ENDPOINT` to forward
  frontend errors to a collector, and consider a cron that hits the `admin` function's
  `health` action and alerts on `healthy: false`.
- **No uptime monitor.** If Supabase is down, you will learn it from a member.
- **No load testing.** The indexes are sensible but unproven under real traffic.
