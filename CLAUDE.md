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
- **Next: Phase 5 — Matching & Compatibility** (see `docs/Roadmap.md`).

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
