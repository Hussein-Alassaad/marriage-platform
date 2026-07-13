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
- **Compatibility engine — deterministic scoring: complete** (real scores + ranked recs).
- **Phase 9 — Subscriptions & Payments: manual (Lebanese) family complete**
  (plans page, OMT/Whish/bank claims, admin approval → tier activation). Card gateway
  (Areeba) still to come; coupons + "can't pay" ticket not built yet.
- **Guardian (wali) system: complete** — invite → accept → per-connection sharing,
  which is what unlocks the Family-stage requirement.
- **Phase 10 — Communication stages: complete for the MVP.** Text, voice (Serious) and
  photos (Family) are fully functional; **video is "Coming Soon" (disabled)**.
- **Conversation suggestions: complete** — the AI proposes what to ask next, per stage.
- **Next: Phase 11 — Marriage Assistant** (see `docs/Roadmap.md`).

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

Compatibility engine delivered: a `compute-compatibility` Edge Function scores eligible
candidates from profile data (deterministic, explainable breakdown — religion, values,
goals, lifestyle, distance, financial, communication, personality; no AI key), upserts
`compatibility_scores`, and rebuilds the caller's ranked `daily_recommendations`. Wired
to a "Generate recommendations" button in Discover (so cards show real % + ranking
instead of the "New" placeholder). Deploy: `supabase functions deploy compute-compatibility`.

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

## Backend setup (per environment)

Linked project: **`kondapkaroqmoduadopj`**. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(copy `.env.example` → `.env`; anon key is public, `.env` is git-ignored). The Home page shows a
live "Systems connected / not configured" badge. `supabase link` + `db push` need the DB
password (ask the user at apply time).
