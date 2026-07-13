# Deployment — Vercel (frontend) + Supabase (backend)

This document is the source of truth for how the app is built and deployed and
which environment variables it requires. It intentionally contains **no
secrets** — only variable names and where each value must live.

---

## 1. Hosting model

- **Frontend (this repo):** static SPA built by Vite, hosted on **Vercel**.
- **Backend:** **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions).
  Not hosted on Vercel.

The browser only ever talks to Supabase with the **public anon key**, through
RLS-protected reads and Edge Functions. All privileged work (AI keys, payment
secrets, service-role access) lives server-side in Supabase Edge Function
environment variables — never in this repo, never in Vercel's client bundle.

---

## 2. Vercel project configuration

`vercel.json` (committed) pins the settings so they don't drift:

| Setting | Value | Why |
|---|---|---|
| Framework | `vite` | Vercel's Vite preset |
| Build command | `npm run build` | runs `tsc -b && vite build` |
| Install command | `npm ci` | reproducible install from `package-lock.json` |
| Output directory | `dist` | Vite's build output |
| Rewrites | `/(.*) → /index.html` | **required** so client-side routes (`/match`, `/finance`, …) survive refresh and deep-links; without this they 404 on Vercel |

Node version: Vercel uses a recent LTS by default (matches local Node 20).

---

## 3. Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for the
Production (and Preview) environments. Both are **public** values safe to expose
to the browser (Vite inlines `VITE_*` vars at build time).

| Variable | Scope | Value source | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel (client) | Supabase → Project Settings → API → Project URL | e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Vercel (client) | Supabase → Project Settings → API → `anon` `public` key | Public by design; protected by RLS |

**Never** add the Supabase `service_role` key (or any AI/payment secret) as a
`VITE_*` variable or to Vercel's client env — `VITE_*` values ship to the
browser. Those secrets belong only in **Supabase Edge Function secrets**
(`supabase secrets set …`), added in later phases.

Local development mirrors these in a `.env` file (see `.env.example`). `.env` is
git-ignored and must never be committed.

---

## 4. First-time deploy (manual, requires your Vercel login)

The repo is deploy-ready. Connecting it to Vercel requires authentication that
only the project owner can perform:

1. Vercel → **Add New Project** → import `Hussein-Alassaad/marriage-platform`.
2. Vercel auto-detects the settings from `vercel.json`.
3. Add the two environment variables above.
4. Deploy.

(Or via CLI: `vercel link` then `vercel --prod` — also requires interactive
login.) Per project policy, this repo's tooling will **not** perform Vercel
authentication automatically; the owner runs the import/login step.

---

## 5. Supabase Auth configuration (dashboard — required for Phase 3)

Set these in the Supabase dashboard for project `kondapkaroqmoduadopj`:

**Auth → URL Configuration**
- **Site URL:** the primary app origin (dev: `http://localhost:5173`; later the Vercel domain).
- **Redirect URLs (allowlist):** add each origin the auth emails redirect back to —
  `http://localhost:5173/**`, `http://127.0.0.1:4173/**`, and the Vercel domain `/**`.
  The app uses `/auth/callback` (email confirmation) and `/reset-password` (recovery).

**Auth → Providers → Email**
- Keep **Confirm email** on for production. The app handles both modes: with confirmation on,
  registration shows a "confirm your email" screen; with it off, it signs in immediately.
- For production email delivery, configure **custom SMTP** (the default sender is rate-limited
  and for testing only).

**Auth → Providers → Phone (required for phone OTP)**
- Enable the **Phone** provider and configure an SMS provider (Twilio / MessageBird / Vonage /
  Textlocal) with its credentials. **Until this is configured, "Send code" on the phone
  verification screen returns a provider error** — the flow is fully wired and will work as soon
  as the provider is set. This is the one external setup Phase 3 needs.

**Auth → Policies**
- Minimum password length: the client enforces 8; set the Supabase minimum to match if desired.

Nothing here is a secret in the repo — SMTP/SMS credentials live only in the Supabase dashboard.

## 5b. Edge Functions

Identity documents are server-only, so identity verification submissions go
through the **`verify-identity`** Edge Function (in `supabase/functions/`).

- Deploy: `supabase functions deploy verify-identity` (requires your Supabase
  login). It uses the default-injected `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` — **no manual secret**, and the service-role key
  never leaves Supabase.
- Until it's deployed, the Verify Identity screen renders normally but a
  submission returns a friendly "service isn't available yet" message.
- Admin approve/reject is a `{ action:'review' }` call to the same function
  (admin-gated); the admin UI arrives with the Admin phase.

**`matchmaking`** powers discovery + the interest flow (cross-user profile reads
are RLS-blocked, and `matches`/`interests` are not client-writable). Deploy:
`supabase functions deploy matchmaking`. Same default-injected keys, no manual
secret. Actions: `discover` (privacy-safe candidate cards; falls back to a simple
verified/opposite-gender query until the compatibility engine runs), `connections`,
`send-interest`, `respond-interest`. Photos are returned only when the candidate's
visibility (and the viewer's tier) allow.

**`send-text-message`** delivers Introduction/Serious-stage chat. Clients can never
insert messages, so this function (service role) ensures the conversation exists,
enforces stage + the per-person introduction quota (`intro_messages_per_person`
setting), moderates, then inserts. Moderation is two layers: an evasion-resistant
local pre-filter (normalizes leetspeak/spacing/abbreviations, blocks contact info,
social handles and premature romance before the Family stage — Decisions Part D)
and an **AI moderator (Claude)** that judges intent. Deploy: `supabase functions
deploy send-text-message`. Voice/image/video senders arrive with their stages.

> The AI moderator needs one secret — set it once, and **never** put it in the
> frontend or in `.env`:
> ```
> supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
> ```
> It is **fail-closed**: if the key is set and the moderator errors or times out,
> the message is not delivered. If the key is absent the function still runs, but
> on the local pre-filter alone.

**`stage-transition`** is the only writer of `matches.stage`. Actions: `status`
(current + next stage, both consents, unmet requirements), `consent` / `withdraw`
(records a `stage_consents` row; advances the match only when BOTH people have
consented and the stage's requirements are met), and `terminate` (ends the
connection with the `rerequest_cooldown_days` cooldown). Requirements per Part D:
Serious needs both users on a paid tier (gate: `serious_stage_requires_paid`);
Family needs the woman's guardian confirmed and granted access to the match (so it
stays locked until the Guardian phase ships); Married needs only mutual
confirmation. Deploy: `supabase functions deploy stage-transition`. Needs the
`20260711120000_stage_consents.sql` migration applied first (`supabase db push`).

**`send-voice-message`** delivers Serious-stage voice notes. The pipeline is strictly
receive → **transcribe** → **moderate the transcript** → only then store and deliver
(Part D). It is fail-closed at every step: no STT provider configured, transcription
fails, the moderator is unreachable, or the transcript violates Part D → the note is
**not delivered and the audio is never stored**. Voice needs a speech-to-text provider
because Claude has no audio input — it is pluggable
(`supabase/functions/_shared/transcribe.ts`), and configured with secrets:

```
supabase secrets set STT_PROVIDER=openai   STT_API_KEY=...   # whisper-1
supabase secrets set STT_PROVIDER=deepgram STT_API_KEY=...   # nova-2
supabase secrets set STT_PROVIDER=custom   STT_API_KEY=... STT_URL=https://...
```

Then flip the admin setting **`voice_enabled` to `true`** so the mic appears. The flag
is UX only — the server refuses voice regardless while STT is unconfigured. Caps
(`voice_max_seconds`, `voice_max_mb`) are settings too. Deploy:
`supabase functions deploy send-voice-message`. Moderation now lives in
`supabase/functions/_shared/moderation.ts` and is shared with `send-text-message` —
text and voice transcripts pass through exactly the same gate.

**`send-image-message`** delivers Family-stage photos (Part D §3), capped per day from
`family_images_per_day` (Married is uncapped). Claude's **vision** moderates the image
*before* it is stored — no moderator, an unreachable one, or a violation means the
image is not delivered and never reaches storage (there is no local pre-filter for
pixels, so an unconfigured `ANTHROPIC_API_KEY` blocks images rather than letting an
unreviewed one through). Turn on `media_enabled` once `ANTHROPIC_API_KEY` is set, and
photos work with no further changes. Deploy:
`supabase functions deploy send-image-message`. Needs
`20260711160000_media_settings.sql` (`supabase db push`).

**`send-video-message`** — **video is disabled for this release ("Coming Soon").** No
model can watch a video, so there is no scalable way to moderate one, and an
unmoderated media channel is not acceptable here. The endpoint rejects every upload
(`501 video_coming_soon`) and the UI shows the button disabled with a Coming Soon
badge. The function documents exactly where a future moderation step slots in (frame
sampling into Claude vision, or a video-capable provider) and what to flip; nothing
else in the messaging system needs to change. Deploy it so the rejection is served
server-side: `supabase functions deploy send-video-message`.

**`suggest-questions`** offers the member a few things they could say next —
stage-aware (Part D), grounded in both profiles and in the recent conversation so it
goes deeper instead of repeating. Unlike the senders it does **not** fail closed: with
no `ANTHROPIC_API_KEY`, or on an error, it returns an empty list and the client shows a
curated per-stage set from i18n. That is safe because a suggestion is not a delivery —
picking one only fills the composer, and sending it still passes the full moderation
gate. Deploy: `supabase functions deploy suggest-questions`.

**`chat-media`** issues short-lived signed URLs for chat media. It signs **only**
media whose `media_status` is `approved` — i.e. media that actually passed moderation
before it was stored — which is the invariant a future video release plugs into. The `chat-voice` /
`chat-images` / `chat-videos` buckets have **no client policies at all** — privacy is
enforced by which file the server hands you — so this function verifies the caller is
a participant of the message's conversation, then signs that one file for 10 minutes.
Deploy: `supabase functions deploy chat-media`.

**`guardian`** is the only writer of the guardian relationship — a self-declared
guardian link is exactly the thing an attacker would forge, so clients cannot write
`guardians`, `guardian_invitations`, or `guardian_access` at all. Actions: `invite`
(women only; one open invitation at a time; returns a one-time code that expires per
`guardian_invite_expiry_days`), `accept` (the invited person redeems the code, must
explicitly declare they are authorised, and is granted the `guardian` role),
`grant-access` / `revoke-access` (she shares ONE connection at a time, revocable),
`my-guardians`, and `shared-matches` (the guardian's whole view — nothing else is
visible to them). This is what satisfies the Family-stage requirement in
`stage-transition`. Deploy: `supabase functions deploy guardian`. Needs the
`20260711140000_guardian_settings.sql` migration applied (`supabase db push`).
Invite delivery is manual for now (she shares the code); email/SMS lands with the
notification service.

**`subscriptions`** is the only writer of a user's tier. Actions: `create-claim`
(starts a manual OMT / Whish / bank-transfer payment — the amount comes from the
plan catalog and the expiry from settings, never from the client), `attach-receipt`
(the client uploads to its own folder in the private `payment-receipts` bucket; the
function validates the path before recording it), `pending-claims` + `review` (admin
only — approving inserts the payment, opens the subscription, and sets
`profiles.subscription_tier`, all audited), and `checkout` (card), which returns
`gateway_not_configured` until `card_payments_enabled` **and** the Areeba secrets
exist — so no fake checkout screen can take a payment that goes nowhere. Deploy:
`supabase functions deploy subscriptions`. Needs the
`20260711130000_payment_settings.sql` migration applied (`supabase db push`).
Payment instructions, claim expiry, and period lengths are admin-editable settings.

**`compute-compatibility`** scores eligible candidates from profile data
(deterministic, no AI key), upserts `compatibility_scores`, and rebuilds the
caller's ranked `daily_recommendations` for today — which `matchmaking.discover`
then reads. Triggered on demand by the "Generate recommendations" button; a
scheduled batch can call the same logic for everyone later. Deploy:
`supabase functions deploy compute-compatibility`.

## 6. Pre-deploy checklist

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` all pass.
- [ ] `.env` is **not** committed (`git check-ignore .env` prints `.env`).
- [ ] `.env.example` contains placeholders only.
- [ ] Both `VITE_*` vars set in Vercel for Production + Preview.
- [ ] Home "backend status" badge reads **connected** once the vars are live.
- [ ] No `service_role` key anywhere in the repo or Vercel client env.
