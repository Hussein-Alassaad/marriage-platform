# CLAUDE.md — AI-Powered Marriage Platform

Context for every Claude Code session. Read this first. The authoritative specs live in
`docs/`: **PRD.md**, **Implementation-Decisions.md**, **Architecture.md**, **Roadmap.md**,
**Development-Handbook.md**. When this file and a doc disagree, the docs win — update this file.

## Current status

- **Phase 1 — Project Foundation & Design System: complete** (incl. a premium motion
  system via Framer Motion + light/dark theming).
- **Phase 2 — Database Schema, RLS & Settings Engine: complete** (applied to the linked
  Supabase project `kondapkaroqmoduadopj`).
- **Phase 3 — Authentication, Roles & Route Guards: complete.**
- **Phase 4 — Profile System & Onboarding: complete.**
- **Verification slice — Identity Verification: complete** (unlocks the matchmaking gate).
- **Phase 5 — Matching & Compatibility: core complete** (discovery + interest flow).
- **Phase 6 — Communication: Introduction text chat complete** (first of four stages),
  with **strict two-layer moderation** and **mutual-consent stage transitions**.
- **Compatibility engine — deterministic scoring: complete** (real scores + ranked recs),
  now **regenerated automatically every night** via pg_cron, not only on manual click.
- **Phase 9 — Subscriptions & Payments: manual (Lebanese) family complete**
  (plans page, OMT/Whish/bank claims, admin approval → tier activation). Card gateway
  (Areeba) still to come; coupons + "can't pay" ticket not built yet.
- **Guardian (wali) system: complete** — invite → accept → per-connection sharing,
  which is what unlocks the Family-stage requirement.
- **Phase 10 — Communication stages: complete for the MVP.** Text, voice (Serious) and
  photos (Family) are fully functional; **video is "Coming Soon" (disabled)**.
- **Conversation suggestions: complete** — the AI proposes what to ask next, per stage.
- **Phase 12 — Finance Module: complete** (personal ledger, tiered dashboard,
  multi-currency, Couple Finance, **monthly reports** — numbers via pg_cron, AI narrative
  on demand once funded). CSV/print exports were already done despite an earlier note here
  saying otherwise.
- **Phase 13 — Notifications & scheduled jobs: complete.** Event-driven delivery (SQL
  trigger, not an Edge Function), quiet hours, digests, preferences; jobs run under
  pg_cron with **no service key**.
- **Phase 14 — Admin dashboard: complete.** Settings editor, verification queue (which
  nobody could do before — see below), user suspension, jobs, audit log, support.
- **Phase 11 — Marriage Assistant: built, and switched OFF.** `assistant_enabled` is
  false until `ANTHROPIC_API_KEY` is funded. It is the one feature with **no key-free
  fallback** — an assistant with no model has nothing to say — so it shows an honest
  "not yet" rather than a chat box that errors on every question.
- **Phase 15/16 (partial): complete.** Data export + account deletion, legal pages,
  Settings page, error telemetry, health checks, `docs/Runbook.md`.
- **Coupons, analytics, finance exports: complete.**
- **Conversation summaries: DROPPED** (owner's decision, 2026-07-14). Not "unbuilt" —
  removed, with the setting and the job registry row deleted so nobody switches it on by
  accident. Summarising a private courtship conversation means a machine reads it and
  writes down what it thinks two people meant; moderation already reads messages for a
  safety reason members accept, and a summary is a second intrusion with no such reason.
- **Remaining:** card payments (Areeba — see below), a11y/perf audit, and external
  alerting. See `docs/Runbook.md` §5 for what is deliberately NOT monitored.

**Card payments are still an honest stub.** `subscriptions.checkout` returns
`gateway_not_configured` until `card_payments_enabled` **and** the Areeba secrets exist.
I did not write an Areeba integration: without the merchant credentials and their API
docs I would be guessing at request shapes and signature formats, and a payment flow that
*looks* implemented but silently fails is far worse than one that says it is not ready.
The manual Lebanese family (OMT / Whish / bank transfer) is fully working, and **coupons
apply to it** — the discount is computed server-side from the coupons table, because a
client-supplied price is a free membership.

Two holes Phase 14 closed that are worth remembering:
1. **`verify-identity` had a review action that nothing ever called.** No member could be
   verified, and verification gates matchmaking — the platform was closed at its own front
   door. Admin → Verification is that queue.
2. **There was no way to suspend anyone.** `profiles.status` + `is_account_active()` now
   exist, and suspension is checked **at the point of action** (sending a message, sending
   an interest), not at login — a session issued a minute earlier must not buy an hour of
   harassment. `revoke update on profiles` + a column-level grant means a client can write
   its own profile fields and nothing else: no self-unban, no self-upgrade.

**Third hole, found and closed 2026-07-26:** nine `security definer` functions from
Phases 13-14 — the seven `job_*` functions, `deliver_notification_event`, and
`is_account_active` itself — had never been locked to `service_role`. Postgres grants
EXECUTE to PUBLIC by default, so any authenticated client could have called them
directly via PostgREST RPC, bypassing `run_job()`'s `enabled` check entirely (e.g.
forcing `job_cleanup_identity_documents()` to delete documents ahead of the configured
grace period, or `job_expire_subscriptions()` to downgrade a tier early). Fixed in
`20260726140000_lock_down_security_definer_functions.sql`, verified live: direct RPC
calls now correctly denied for all nine, while `run_job()` itself still works (its
internal calls run as the definer, unaffected by the revoke). The pattern to watch for
going forward: **any new `security definer` function needs an explicit
`revoke ... from public, anon, authenticated` + `grant ... to service_role`** — it is
never automatic, and this is the second time it's been missed (the first was caught
same-day for `compute_compatibility_for_user`/`run_job` in
`20260725100000_daily_match_generation.sql`).

**The dangerous state to know about:** `moderation_ai_enabled = true` with no funded key.
Moderation fails **closed**, so that combination blocks *every message on the platform*
while raising no error anywhere. Admin → Overview checks for it explicitly.

Finance delivered (Phase 12): tiers follow Decision #17 — Free adds income/expenses and
sees a plain history; Serious adds charts, statistics, budgets and savings goals; the
married couple can connect **Couple Finance**. Each gate reads its minimum tier from
settings (`finance_charts_min_tier`, `basic_shared_finance_tier`), so a feature moves
between tiers without a deploy. Nothing is teased and then locked.

Money (Decision #14): amounts are **stored in the currency the member typed** and
converted only for display — a stored USD figure does not stay honest against the LBP.
Conversion pivots through USD via `exchange_rates`; an amount whose currency has no rate
is **reported, never silently dropped** (`sumIn` returns `unconvertible`). The rate job
(Phase 13) will refresh the seeded rates daily.

Monthly reports delivered (2026-07-25): the `monthly_finance_reports` job — registered
disabled since Phase 2 — now runs on the 1st via pg_cron, same "plain SQL, no service
key" pattern as the other jobs (`20260725120000_monthly_finance_reports.sql`). For every
Serious+ member with activity that month it freezes one `financial_reports` row: income/
expenses/net in their display currency, spend by category, budget-vs-actual, savings-goal
progress, and the prior month's totals for a trend line — currency conversion resolved
and frozen at generation time (Decision #14), same as a payment receipt. The `narrative`
field starts null; opening a report for the first time calls the `finance` Edge
Function's `report-narrative` action, which needs `ANTHROPIC_API_KEY` and caches the
paragraph back onto the row — the report itself is real with or without the key, same
degrade pattern as `suggest-questions`. `MonthlyReportCard` renders it in Finance.
`generate_monthly_report_for_user`/`job_generate_monthly_reports` are service_role-only
(a client passing an arbitrary user id must never force-write someone else's report).

**Marriage Plus Couple Finance delivered (2026-07-26):** while building monthly reports,
found that Serious and Marriage Plus were functionally identical in Finance —
`finance_shared_min_tier` (seeded Phase 12, `marriage_plus`, described as gating "advanced
Couple Finance") was never read anywhere; only `basic_shared_finance_tier` (seeded Phase 2,
default `serious`) was wired, gating the shared-totals feature that already existed. This
closes that gap by wiring the abandoned setting to something real, not adding a second
setting alongside it: on top of the shared **monthly totals** every Serious+ married
couple already gets, a couple where **both** spouses additionally hold
`finance_shared_min_tier` unlocks a joint **budget** (a category target checked against
the SUM of both spouses' spending — never either person's individual entries, same
"totals only" narrowness as the base feature) and a joint **goal** (one running balance
either spouse can add to — a shared jar, not a ledger of who contributed what).
`shared_budgets`/`shared_goals` (`20260726100000_shared_budgets_goals.sql`) are
Edge-Function-only like `shared_finance` — RLS lets a participant *read* their match's
rows, and only while `shared_finance.active` (a disconnect hides them immediately,
verified with a rolled-back RLS test); every write goes through new `finance` actions
(`shared-budget-save`/`-delete`, `shared-goal-save`/`-contribute`/`-delete`), re-checking
both tiers and the active connection on every call — never trusted from an earlier
status check. `SharedBudgetsGoalsCard` renders it inside the Couple Finance card, with an
honest upsell (no fake preview) when the connection is active but the tier gate isn't met
yet.

Personal finance is **the one domain the client writes directly** — every row is
owner-only under RLS and there is deliberately **no admin read policy** on those tables:
admins get aggregates, never a member's spending. **Couple Finance crosses two users, so
it is Edge-Function-only** (`finance`): the Married stage, *both* consents and *both*
tiers are required to activate; either spouse disconnects alone; terminating the match
disconnects it (wired into `stage-transition`). What is shared is **monthly totals, never
individual entries**. Deploy: `supabase db push` then `supabase functions deploy finance`
(and re-deploy `stage-transition`).

Suggestions delivered: `suggest-questions` — stage-aware ideas for what to say next,
grounded in both profiles and the last ~14 messages so it deepens the conversation
rather than repeating it. Rendered as chips above the composer; **picking one fills the
box, it never sends** — the member edits and sends in their own words, and the message
still passes the full moderation gate (a suggestion is never a bypass). This surface
deliberately does *not* fail closed: with no key or on error it returns `[]` and the
client falls back to a curated per-stage set in i18n, so the feature degrades to
"slightly less clever" instead of "broken".

Family photos delivered: `send-image-message` — Claude **vision** moderates the image
before it is stored (no moderator, an unreachable one, or a violation ⇒ never
delivered, never stored). Per-day cap from `family_images_per_day` (Married uncapped);
`media_enabled` (default false) reveals the button once `ANTHROPIC_API_KEY` exists,
after which photos work with no code changes.

**Video is deliberately disabled** for this release: no model can watch a video, so
there is no scalable way to moderate one, and an unmoderated media channel is not
acceptable here. `send-video-message` rejects every upload (`501 video_coming_soon`),
the composer shows the button disabled with a Coming Soon badge, and the earlier
human-review queue is gone. The function documents exactly where a future moderation
step slots in; `chat-media` still signs **only** `media_status = 'approved'` media, so
that invariant is what a video release plugs into — no other part of messaging changes.

Voice delivered: `send-voice-message` — receive → **transcribe** → **moderate the
transcript** → only then store and deliver. Fail-closed at every step (no STT provider,
transcription failure, moderator unreachable, or a Part D violation ⇒ the note is not
delivered and **the audio is never stored**). Claude has no audio input, so STT is a
pluggable provider (`_shared/transcribe.ts`: `openai` | `deepgram` | `custom`) set via
`STT_PROVIDER` / `STT_API_KEY` secrets; the `voice_enabled` setting (default **false**)
reveals the mic once they exist — the flag is UX, the server check is the boundary.
Moderation now lives in `_shared/moderation.ts`, shared by text and voice, so both pass
the identical gate. `chat-media` issues participant-checked, 10-minute signed URLs
(the chat buckets have no client policies at all). UI: a record → review → send
recorder (auto-stops at `voice_max_seconds`) and a voice bubble that lazily fetches
playback and shows the moderated transcript beneath.

Guardian delivered: a `guardian` Edge Function — the only writer of the guardian
relationship (clients cannot write `guardians` / `guardian_invitations` /
`guardian_access` at all). She invites one guardian (`invite` → a one-time code that
expires per `guardian_invite_expiry_days`); he redeems it at `/guardian/accept`,
**explicitly declaring** he is authorised, and is granted the `guardian` role; she
then shares connections one at a time (`grant-access` / `revoke-access`), which is
exactly what satisfies the Family requirement in `stage-transition`. A guardian never
browses: `shared-matches` returns only what she shared, and she can revoke any of it
instantly. Pages: `/guardians` (hers — invite, code, per-connection sharing) and
`/guardian` (his — the shared connections). The relationship is *declared* by her and
*confirmed* by him; the UI says plainly that Mithaq does not verify it (Decisions §9).
Deploy: `supabase db push` then `supabase functions deploy guardian`.

Subscriptions delivered: a `subscriptions` Edge Function — the only writer of a
user's tier. `create-claim` (amount from the plan catalog, expiry from settings —
never the client), `attach-receipt` (client uploads to its own folder in the private
`payment-receipts` bucket; the function validates the path), admin `pending-claims` +
`review` (approve → payment row + subscription + `profiles.subscription_tier`, all
audited), and a `checkout` action that honestly returns `gateway_not_configured`
until Areeba credentials exist. A **Plans page** (`/plans`) with the DB-driven plan
comparison, monthly/yearly toggle, the manual-payment flow (method → reference code →
receipt upload → "under review"), and a **payments review queue** on the Admin page
(the only way a claim can be approved). Payment instructions/expiry/period lengths are
admin-editable settings. Deploy: `supabase db push` then
`supabase functions deploy subscriptions`.

Journey transitions delivered: a `stage_consents` table (client-read-only) + a
`stage-transition` Edge Function — the **only** writer of `matches.stage`. A match
advances only when BOTH participants consent to the same next stage *and* that
stage's requirements are met (Serious: both on a paid tier, gated by the
`serious_stage_requires_paid` setting; Family: the woman's guardian confirmed and
granted match access — so Family stays locked until the Guardian phase; Married:
mutual confirmation). Either party can `terminate` (cooldown from settings). Surfaced
as a `JourneyPanel` above the conversation showing both consents, the unmet
requirements (never a silent disabled button), and End connection. Deploy:
`supabase db push` then `supabase functions deploy stage-transition`.

**Moderation mode (important).** The AI layer needs a *funded* Anthropic API key (a Claude
Pro chat subscription does not fund the API). Until there is one, the platform runs in
**local-only mode**: leave `ANTHROPIC_API_KEY` unset, or set `moderation_ai_enabled = false`.
The key-free pre-filter is then the only moderator — it blocks numbers, emails, links,
handles, named platforms, off-platform requests and obfuscated romance, but **matches
patterns, not intent**, so a cleverly worded hint gets through. That is a recorded
trade-off, not a fail-open. Flip the setting back to `true` when the key is funded (no
redeploy). Photos have **no** key-free fallback, so `send-image-message` refuses them in
this mode — keep `media_enabled` off. AI moderation stays fully wired for that day.

Chat moderation is two layers: an evasion-resistant local pre-filter (normalizes
accents/leetspeak/stretched letters/separators/chat shorthand, so "l0ve u", "ily" and
"i n s t a g r a m" are all caught; detects handles, URLs, emails and phone numbers)
and an **AI moderator (Claude)** that judges intent against the Part D stage rules.
**Fail-closed**: configured but unavailable → the message is not sent. The key lives
only in Supabase: `supabase secrets set ANTHROPIC_API_KEY=...` (never in the frontend).

Compatibility engine delivered: the scoring formula (deterministic, explainable breakdown —
religion, values, goals, lifestyle, distance, financial, communication, personality; no AI
key) lives in one place, the SQL function `compute_compatibility_for_user`
(`20260725100000_daily_match_generation.sql`), so the on-demand path and the scheduled
path can never disagree. The `compute-compatibility` Edge Function calls it for the caller
(wired to a "Generate recommendations" button in Discover), and the `daily_match_generation`
pg_cron job (registered disabled in Phase 2, enabled here) calls it for every verified
member nightly — so `compatibility_scores` + ranked `daily_recommendations` refresh on
their own, not only when someone clicks. Both `compute_compatibility_for_user` and
`run_job` are service_role-only (no client can force-write another user's recommendations
by calling the RPC directly). Deploy: `supabase db push` then
`supabase functions deploy compute-compatibility`.

Tiered recommendations + Marriage Plus refresh + search filters delivered (2026-07-26):
another audit gap, same shape as the Marriage Plus finance one — `daily_recs_free`/
`_serious`/`_marriage_plus` and `plus_refresh_per_day` were seeded in Phase 2 and never
read; `compute_compatibility_for_user` hardcoded `limit 20` for everyone regardless of
tier. Fixed in `20260726110000_tiered_recommendations.sql`: the function now looks up the
caller's tier-matched setting, and every serve is logged to `served_recommendations`
(also seeded, also unused, since Phase 2). A new `refresh_recommendations_for_user` is
Marriage Plus only, rate-limited by `plus_refresh_per_day` (a `recommendation_refresh_counters`
table, service_role-only), and — the actual point of "refresh" — excludes anyone already
in `served_recommendations`, so it surfaces genuinely different profiles instead of
recomputing the same top N (verified live: a refresh with nobody-new-to-show correctly
returns `ok: 0` rather than repeating someone). This does not implement the fuller
"no-repeat unless persistently strongest" design the Roadmap describes for the nightly
job itself — that is a separate, bigger feature. Discover also gained real **search
filters** (age range, country, city, education) — Serious+, applied server-side in
`matchmaking`'s `discover` action; a free-tier request with filters is served unfiltered
rather than rejected, since the UI never shows the panel to them. This is what the Plans
page's "Advanced search filters" bullet now actually means; its Marriage Plus sibling,
"Priority support and visibility," was removed instead of built — no priority queue or
ranking boost exists anywhere, and the phrase had no concrete technical meaning to build
toward (`20260726120000_plan_and_settings_cleanup.sql`, which also deleted two other
dead-since-Phase-2 settings, `moderation_strictness_default` and `wali_mode` — neither
was ever read anywhere; moderation mode is entirely `moderation_ai_enabled`, and the
guardian flow has no mode branching). Deploy: `supabase db push` then
`supabase functions deploy compute-compatibility` and `supabase functions deploy matchmaking`.

Session inactivity timeout delivered (2026-07-26): `session_inactivity_minutes` (seeded
Phase 2, default 60) was the last of that audit's dead settings — flipped to public
(`20260726130000_session_timeout_setting.sql`; the value itself isn't sensitive, same
category as `intro_messages_per_person`) and wired into `SessionContext`, which now signs
a member out after that many minutes of no mouse/keyboard/touch activity and redirects to
`/login` with a plain-language notice. This is a client-side floor, not a server-enforced
session expiry — a stolen access token would still work until Supabase's own token expiry;
closing that gap would mean server-side session revocation, a separate, larger change.

Phase 6 (Introduction) delivered: a `send-text-message` Edge Function (clients can't
insert messages; it ensures the conversation, enforces stage + the per-person intro
quota from settings, runs key-free Part-D moderation that blocks contact info before
the Family stage, then inserts). `chatService` + `useChat` (messages gently polled for
near-live updates — no Realtime setup needed). A **ConversationPage** (`/messages/:matchId`,
verified-gated) with bubbles, composer, quota badge, and blocked/quota notices; opened
from an accepted match in Match → Connections. Deploy: `supabase functions deploy
send-text-message`.

Phase 5 core delivered: a `matchmaking` Edge Function (cross-user reads are RLS-blocked
and matches/interests aren't client-writable, so discovery + the interest flow run
server-side, returning only privacy-safe candidate fields; photos gated by the
candidate's visibility + viewer tier; `discover` falls back to a verified/opposite-gender
query until the compatibility engine's batch job runs). `matchService` + `useMatch`
hooks; a real **Match page** with Discover (candidate cards, compat ring, save/pass,
send-interest modal with a note) and Connections (incoming interests accept/decline,
your matches, sent interests). Saved/declined/viewed are direct RLS writes. Deploy:
`supabase functions deploy matchmaking`. Still engine-less (real scores/daily recs land
with the batch job); accepting an interest advances the match to `introduction` — chat
arrives in Phase 6.

Verification slice delivered: `verificationService` + `useVerification`, a **Verify
Identity** page (`/verify-identity`; submit → pending → verified/rejected states), the
**`verify-identity` Edge Function** (multipart submit uploads to the private
`identity-documents` bucket + inserts a pending `identity_verifications` row; admin
`review` action; a DB trigger locks gender + flips the profile on approval). The match
gate (`RequireVerified`) and the profile status badge now link to it. Deploy the
function with `supabase functions deploy verify-identity` (see `docs/Deployment.md §5b`).

Phase 4 delivered: `profileService` (owner reads/writes own `profiles` row via RLS +
`min_age`/`gender_lock` triggers; photo upload/list/signed-URL/delete on the private
`profile-photos` bucket), `useProfile`/`useUpdateProfile` (React Query; recomputes
`profile_completion`, refreshes session), a resumable 6-step **onboarding wizard**
(`/onboarding`, incremental saves, direction-aware, RTL), a real **Profile page**
(completion `ProgressRing`, verified/tier badges, view sections, photo manager +
visibility), reference option lists with i18n labels, and bilingual EN/AR keys. The
sign-in scene remains the character-free Mithaq/Islamic-architecture design.

Phase 3 delivered: Supabase Auth wired via `authService` + `SessionProvider`/`useSession`
(session, profile, roles, verification status); register (display name, email, password,
**gender + DOB validated against the `min_age` setting**), login, logout, forgot/reset password,
email-confirmation callback, and a **phone-OTP** flow (needs an SMS provider — see
`docs/Deployment.md`). Route guards: `RequireAuth`, `RequireRole` (admin/guardian from real
`user_roles`), `RequireVerified` (matchmaking gate). Sidebar role nav + a user menu with sign
out. Forms use React Hook Form + Zod. One additive migration extends `handle_new_user` to persist
DOB. Frontend checks are UX only — RLS/triggers remain the real boundary.

Phase 1 delivered: Vite + React 18 + TS (strict) app shell; Tailwind v4 emerald/off-white
design system; **Framer Motion** motion primitives (animated Button, reveal/stagger, page
transitions, `layoutId` nav indicator, count-up, hover-depth) + **dark mode** (CSS-variable
theming, toggle, `prefers-color-scheme` default); bilingual EN/AR with RTL/LTR flipping;
responsive nav; placeholder pages for all routes; Supabase client + service accessors wired
via env; React Query provider; Vitest + ESLint + Prettier; GitHub Actions CI.

Phase 2 delivered: 15 migrations in `supabase/migrations/` — **53 tables, all with RLS
(deny-by-default), 60 policies, 15 enums, 6 private storage buckets**, seeds (settings, plans,
job registry), and the four-stage communication schema. Includes the approved improvements:
soft delete, moderation versioning, AI-usage analytics (`ai_requests`), and immutable
`settings_history`. Verified on remote (RLS negatives pass; protected inserts → 401). No Edge
Functions or feature UI yet — those arrive per phase.

## Tech stack

React 18 · TypeScript (strict) · Vite 6 · Tailwind CSS **v4** (CSS-first `@theme` in
`src/index.css`, `@tailwindcss/vite` plugin — no `tailwind.config.js`) · React Router 6 ·
TanStack React Query · i18next · Lucide icons · Supabase JS. Backend (Supabase: Postgres, Auth,
Storage, Realtime, Edge Functions) is wired but unschemad until Phase 2.

## Commands

```bash
npm run dev         # start dev server
npm run build       # tsc -b && vite build
npm run typecheck   # tsc -b
npm run lint        # eslint .
npm test            # vitest run
npm run format      # prettier --write .
```

## Architecture guardrails (do not break these)

- **No business logic in components.** Components render; data/logic lives in `services/` →
  hooks → components. Components never import the Supabase client directly (use `services/`).
- **No client writes to protected tables.** Messages, matches, subscriptions, payments, and
  verification are written only by Edge Functions. If a feature "needs" a client insert, the
  answer is a new Edge Function. Clients never insert messages of any type.
- **No hardcoded limits, prices, thresholds, or user-facing strings.** Tunables come from the
  `settings` table (Phase 2+); all copy comes from `src/i18n/locales/{en,ar}.json`.
- **No secrets in the frontend.** Only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public
  anon key). Service-role / AI / payment keys live only in Edge Function env.
- **Fail-closed rules are sacred** (later phases): moderation unavailable → message not sent;
  photo permission check fails → blurred/denied. Never "fail open for better UX."
- **RTL is first-class.** Use Tailwind **logical** utilities (`ms-/me-/ps-/pe-`, `border-s/-e`,
  `start-/end-`) — never `left/right`. Direction flips via `dir` on `<html>` (LanguageProvider).
- **One canonical journey stage** (Phase 2+): `introduction → serious_communication → family →
  married` (+ `interest_sent`, `terminated`), changed only via the `stage-transition` function.
- Every async view needs loading (Skeleton), empty (EmptyState), and error states — no blank
  screens. `any` is banned; `strict` stays on.

## Folder conventions (Architecture §16 — do not add new top-level folders)

```
src/
  app/         App, providers, router, routes, layouts/, navigation/
  components/  Design system only (no domain knowledge): Button, Card, Input, Modal, Badge,
               Skeleton, EmptyState, PageHeader, ComingSoon, Logo, LanguageSwitcher
  features/    One folder per domain (home, match, finance, assistant, notifications, profile,
               settings, admin, guardian, auth, errors). Features never import from each other.
  contexts/    LanguageContext (session/theme later)
  hooks/       useLanguage, useDirection (useAuth, useJourneyStage, useSettings later)
  lib/         supabase client, queryClient
  services/    backendService (domain services added per phase); the only Supabase callers
  i18n/        i18next setup + locales/en.json, ar.json
  utils/       cn() and formatters
  test/        Vitest setup + tests
```

Design-system components never import from `features/`. Feature components never import from
other features — shared needs move to `components/`, `hooks/`, or `utils/`.

## Communication stages & media (Decisions Part D — for Phases 8 & 10)

Introduction = **text only** (10/person). Serious = text + **unlimited voice** (record →
transcribe → moderate → deliver; fail-closed). Family = + **images/videos** (default 3 img/day,
2 vid/day, admin-configurable); contact info now allowed. Married = all media, safety-only
moderation. Message types: `text | voice | image | video`, each via its own Edge Function
(`send-text-message`, `send-voice-message`, `send-image-message`, `send-video-message`). Private
buckets `chat-voice`, `chat-images`, `chat-videos` via signed URLs.

## Database (Phase 2) — schema, RLS, migrations

- **Migrations-first.** All schema lives in `supabase/migrations/` (timestamped SQL). Never
  edit an applied migration; add a new one. Apply with `supabase db push` (prompts for the DB
  password — ask the user; never store it, never request the service_role key).
- **Enums** are the source of truth for journey stage, roles, tier, message type, moderation
  verdict/mode, verification/interest/media status — defined in `20260709120000_foundation.sql`.
- **One canonical `matches.stage`** (`interest_sent → introduction → serious_communication →
  family → married`, + `terminated`); changed only via the (future) stage-transition function.
- **RLS is deny-by-default on every table.** Helpers: `is_admin()`, `is_paid()`,
  `is_match_participant()`, `is_conversation_participant()`, `guardian_has_access()` (all
  SECURITY DEFINER). Clients **cannot** insert messages/matches/subscriptions/payments/
  verification (RLS + explicit REVOKEs in `..._rls_hardening.sql`). Admins are structurally
  blocked from personal finance and private conversations/assistant chats.
- **Communication rules (Part D)** are enforced by `enforce_message_stage_rules()` (blocks
  disallowed media per stage) + settings (`intro_messages_per_person`, `family_images_per_day`,
  `family_videos_per_day`, …). Numeric limits live in `settings`, never in code.
- **Append-only** (immutable) tables: `stage_history`, `audit_logs`, `settings_history`,
  `message_moderation` (via the `prevent_mutation()` trigger).
- **Soft delete** (`deleted_at`/`deleted_by`): profiles, matches, conversations, messages,
  guardians, notifications.
- **Storage buckets** (all private, signed-URL access): `profile-photos`, `identity-documents`,
  `payment-receipts`, `chat-voice`, `chat-images`, `chat-videos`. Identity docs + chat media are
  server-only (uploads via signed URLs from Edge Functions).

## Requirements audit fixes (2026-07-26)

A full pass against `docs/PRD.md`/`Implementation-Decisions.md` (not just this file's own
claims) turned up six real gaps — features the PRD specifies that had nothing behind them,
found the same way the Marriage Plus finance gap and the tiered-recommendations bug were
found earlier. All six are now built, each verified against the live database with a
rolled-back transaction before being trusted:

1. **Violation escalation ladder** (Decisions Part D). The `violations` table existed since
   Phase 2 with RLS and a comment describing "block → warning → temp suspension → admin
   review" — nothing ever inserted a row. `record_violation` (service_role-only,
   `20260726150000_violation_escalation_ladder.sql`) is now called by every send-*-message
   function on a real content violation (never for `unavailable` — a moderator outage isn't
   the member's fault): 2nd violation → a notification; 3rd → auto-suspends via the existing
   `profiles.status`/`suspended_until` mechanism (`violation_suspension_days` setting,
   default 3); severe (inappropriate/scam/unsafe) or repeated (5+) → `requires_review = true`,
   surfaced in a new "Flagged for review" section in Admin → Users (`flagged-violations`/
   `violation-review` admin actions), reusing the existing suspend/ban flow.

2. **"Can't pay? Contact us"** (PRD's exact required button + Arabic copy). Missing
   entirely from the Plans page. `support_tickets` already allowed a client to insert its
   own row (`support_tickets_insert_own`, Phase 9) — nothing had ever used that path. Now a
   real button opens a form (reason + details), always visible, never gated behind choosing
   a plan first.

3. **Profile Quality Score + Marriage Readiness Score** (PRD Part 5) — two named features,
   zero code. Both deterministic (`profileService.ts`, unit-tested in `scores.test.ts`), no
   AI key required — same tradeoff as the compatibility engine: Marriage Readiness is five
   equal PRD-specified checkboxes; Profile Quality averages that plus photo count, bio
   length, and verification status. The PRD's own requirement — "must never be presented as
   an objective measure of someone's worth or suitability for marriage" — is the literal
   disclaimer text under both rings on the Profile page.

4. **Financial Health Score** (PRD Part 8) — same story, deterministic
   (`financialHealth.ts`, unit-tested): savings rate, budget consistency, emergency-fund
   months-covered, income stability, goal progress. Debt Level (PRD: "optional") is
   deliberately omitted — there is no debt-tracking field anywhere in the schema, and adding
   one just for this score was out of scope. "Educational only. Never judge users." (PRD) is
   the disclaimer shown with it.

5. **Wali Modes** (PRD): recommended/guided/strict, admin-configurable. `wali_mode` was
   seeded in Phase 2, then *deleted this same session* as apparently-dead cleanup before the
   PRD pass surfaced that it was a real, unbuilt requirement — re-seeded
   (`20260726160000_wali_modes.sql`) and wired into `stage-transition`: 'strict' makes
   guardian-readiness an actual requirement for entering Serious Communication (the same
   check Family stage already used); 'recommended'/'guided' surface a non-blocking
   `familyRecommended` nudge instead. The two non-strict modes are functionally identical on
   purpose — the PRD's own distinction between them is a copy/tone difference, not a
   mechanical one, and there's no funded AI key to make "AI suggests" behave differently
   from a static banner.

6. **Analytics expansion** (PRD Part 13). Added to the `analytics` admin action: user
   demographics (gender/age/country/city — country and city capped to the top 10 with
   everything else folded into "other", so a rare, potentially identifying location never
   appears on its own), a communication breakdown (why messages get blocked, categories
   only, never content), a support-ticket breakdown, a safety-monitoring panel (violations
   by category, flagged-for-review count, suspended/banned counts, moderation-unavailable
   count), an Executive Summary, and Business Intelligence insights. The insights are
   deterministic, rule-based sentences from the numbers already computed (no AI key) —
   returned as `{key, params}` so the frontend renders the actual sentence via i18n, same
   "AI-shaped but real" tradeoff as the rest of this platform's scores. There is no
   prompt-injection/abuse-pattern detector anywhere in the codebase; the safety panel
   reports what this platform actually instruments (violations, moderation log), not a
   fabricated capability. Also added, same-day follow-up (2026-07-26): **match timing**
   ("Average Time Until X Stage", PRD) computed straight from `stage_history`'s existing
   timestamps — no new tracking needed, since every stage change was already logged since
   Phase 8; and **"Most Used Filters"** (PRD), a small service-role-only event log
   (`filter_usage_events`) `matchmaking`'s `discover` writes to whenever a Serious+ member's
   filters are applied.

7. **Privacy toggles** (PRD Part 5): Online Status, Read Receipts, Activity Status — none
   existed as fields. `last_active_at` (profiles, client-writable, touched by
   `SessionContext` every 2 minutes while the tab is visible) backs online/activity status;
   `messages.read_at` backs read receipts, client-writable only via a column-level grant
   (mirrors the `profiles` precedent exactly) plus an RLS policy that lets a participant
   mark the OTHER person's message read — never their own (verified live: sender-marks-own
   → 0 rows, recipient-marks-theirs → 1 row, tampering with `body` via the same UPDATE →
   denied). All three toggles default **on** and live in the existing `privacy` jsonb
   column — nothing new to grant for the toggles themselves. Visibility is gated entirely
   by the *other* person's own toggle when read back out (matchmaking's `discover`, the
   chat bubble's "Seen" label) — a member who opts out simply never has the timestamp
   returned to anyone.

**Also found and fixed in the same pass, same bug class as the above (SECURITY DEFINER
functions never locked to service_role):** nine functions from Phases 13–14 — see the
"Third hole" note earlier in this file.

**Trust Score delivered (2026-07-26, same-day follow-up):** deterministic, unit-tested
(`computeTrustScore`, `profileService.ts`) — identity verification, profile completeness,
conduct (the `violations` table — "respectful communication" and "policy violations" are
the PRD's own two names for that one signal, not counted twice), and account age, equally
weighted. "Reports (after review)" and "positive engagement" are omitted: there is no
blocking/reporting feature and no engagement metric anywhere in the schema to back them —
same reasoning as Financial Health's optional Debt Level being left out. A 3rd ring next
to Profile Quality / Marriage Readiness on the Profile page.

**Found, NOT built, still flagged:** the PRD's much longer Analytics wishlist beyond what
Match Analytics needed (dozens of additional metrics — fake-account detection chief among
them) was triaged to the specific gaps found, not built exhaustively line-by-line.
**Fake-account detection in particular is deliberately out of scope here** — it is a real
anti-fraud feature (stolen-photo detection, duplicate-account heuristics, bot-signup
patterns), not a quick formula, and deserves its own scoping conversation about what
"fake" should even mean for this platform rather than a guessed-at implementation.

**Honest limit on the session-inactivity timeout** (a separate, earlier fix this same
day): it is a client-side floor, not a server-enforced session expiry. A stolen access
token still works until Supabase's own token expiry regardless of this feature; closing
that gap would mean server-side session revocation, a separate, larger change.

## Backend setup (per environment)

Linked project: **`kondapkaroqmoduadopj`**. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(copy `.env.example` → `.env`; anon key is public, `.env` is git-ignored). The Home page shows a
live "Systems connected / not configured" badge. `supabase link` + `db push` need the DB
password (ask the user at apply time).
