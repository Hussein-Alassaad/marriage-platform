# Architecture Document — AI-Powered Marriage Platform
**Version 1.1 · Based on PRD/SRS v4.0 + Official Implementation Decisions #1–#18 + Refinements (provider-agnostic AI & payments, notifications, jobs, observability, DR, Finance ruling)**
**Status: Pre-implementation. No code exists yet.**

---

## 1. Final Tech Stack

**Decision:**
- Frontend: React 18 + TypeScript (strict) + Vite + Tailwind CSS + React Router + TanStack React Query + React Hook Form + Zod
- Backend: Supabase (PostgreSQL, Auth, Storage, Realtime, **Edge Functions in the MVP**)
- AI: a **provider-agnostic AI Provider Layer** (OpenAI is the first provider; Anthropic, Gemini, or others plug in later), called **only** from Edge Functions
- Payments: a **provider-agnostic payment adapter system** (Areeba is the first Lebanese card gateway; OMT, Whish, and Bank Transfer as manual adapters)
- Charts: Recharts · Icons: Lucide · i18n: i18next

**What it means:** One React web app talks to Supabase. Supabase gives us the database, login system, file storage, live chat updates, and small server programs (Edge Functions) — all in one platform, so we don't build or manage our own servers.

**Why:** Decision #16 requires a production-ready MVP (real auth, AI, payments). Edge Functions are therefore **mandatory from day one** (this supersedes the PRD's "Edge Functions (Future)" note) — they are the only place API keys, moderation, and payment logic can live safely. This stack is proven, cheap at small scale, and scales to the PRD's 100k+ user goal.

---

## 2. High-Level System Architecture

**Decision:** A three-layer model:

1. **React SPA (browser)** — UI only. Never holds secrets, never talks to OpenAI or the payment gateway directly.
2. **Supabase Database with Row Level Security (RLS)** — the frontend may read/write *simple, personal* data directly (own profile, own finance entries), protected by RLS rules.
3. **Edge Functions** — every operation with business rules goes through here: sending a message (moderation), sending interest (limits), matching, subscription activation, AI calls, payment webhooks.

**What it means:** Think of RLS as a security guard inside the database ("you can only see your own rows"), and Edge Functions as a back office where the sensitive work happens. The browser is just a display.

**Why:** If the frontend could write messages directly, moderation could be bypassed. If it held AI keys, they'd be stolen in minutes. This split enforces the PRD's core rules (moderation cannot be bypassed, keys never exposed) at the architecture level, not just by convention.

---

## 3. Frontend Architecture

**Decision:**
- Feature-based structure (each module — match, chat, finance, assistant, admin, guardian — is its own folder with its pages, components, and hooks).
- A shared **design system** folder: Button, Card, Badge, Modal, Skeleton, Chart wrappers — built once, reused everywhere.
- A **service layer**: components never call Supabase directly; they call functions like `matchService.sendInterest()`.
- One **journey-state hook** that reads the canonical stage and tells every screen what is allowed.

**What it means:** UI components only display things. All data logic lives in service files. Every screen asks the same question — "what stage is this match in?" — from one place.

**Why:** The PRD demands strict UI consistency and forbids business logic in components. The single journey hook prevents the biggest bug class in this app: one screen thinking the couple is in the Introduction Stage while another thinks they're in the Family Stage.

---

## 4. Backend / Supabase Architecture

**Decision:** Split responsibilities:
- **Direct DB access (via RLS):** read own profile, read allowed profiles, own finance CRUD, read own notifications, read conversations you belong to.
- **Edge Functions (server-side only):** `send-message`, `send-interest`, `moderate`, `ai-gateway` (assistant, summaries, coaching), `compatibility-engine`, `verify-identity`, `payment-webhook`, `manual-payment-claim`, `guardian-invite`, `stage-transition`, `notification-dispatch`, `admin-actions`, plus scheduled job functions (see §21).
- **Postgres functions/triggers** for counters (messages remaining, daily request counts) so limits can't be raced or faked.

**What it means:** Reading data = mostly direct and fast. Changing anything important = always through a server function that checks the rules first.

**Why:** Limits (10 intro messages, 5 requests/day) and moderation are trust boundaries. They must be enforced where the user can't touch them.

---

## 5. Database Approach

**Decision:**
- Normalized PostgreSQL using the PRD's table list (Users, Profiles, Matches, Messages, MessageModeration, Subscriptions, Payments, Guardians, FinanceAccounts, AuditLogs, Settings, etc.).
- **One `matches` table holds the canonical journey stage** as an enum: `introduction → serious_communication → family → married` (plus `interest_sent`, `terminated`). Every permission check reads this column. Stage changes happen only via the `stage-transition` Edge Function, which records a history row.
- All tunable values (limits, prices, min age, cooldown days, moderation strictness, feature flags, per-stage media limits) live in a `settings` table — never in code.
- The `messages` table carries a `type` enum (`text`, `voice`, `image`, `video`) plus a media reference into the relevant private chat bucket (Decisions Part D); which types are permitted is gated by the journey stage.
- Soft deletes, `created_at`/`updated_at` everywhere, immutable `audit_logs`.

**What it means:** There is exactly one place that says where a couple is in their journey (Decision: one canonical state model). "Configurable" means "a row in the settings table an admin can edit."

**Why:** The original PRD had three conflicting stage models; Decisions #1–#4 collapsed them into one. Encoding that as a single enum column makes the contradiction physically impossible to reintroduce. The settings table satisfies the "no hardcoded values" rule.

---

## 6. Authentication & Authorization

**Decision:**
- Supabase Auth: email + password, plus phone OTP verification. Google/Apple prepared but disabled.
- Authorization = **RLS policies in the database** + **role checks in Edge Functions**. Frontend checks are for UX only, never for security.
- A `user_roles` table (not a column) so one person could later hold multiple roles.
- Feature access is computed server-side from: role + subscription tier + identity-verification status + journey stage.

**What it means:** Logging in proves who you are. What you can *do* is decided by the database and server functions every single time — even if someone hacks the UI, the database refuses them.

**Why:** The PRD is explicit: "Never trust frontend permissions alone." Identity verification is now a hard gate (Decision #5) — an unverified user can browse but is invisible to matching; that check must be in RLS and functions, not a hidden button.

---

## 7. User Roles & Permissions

**Decision:** Roles: `user` (gender: man/woman, set at registration, locked after ID verification per Decision #8), `guardian`, `admin`, `super_admin` (+ `moderator` reserved).

- **User:** full app, subject to tier + stage + verification gates.
- **Guardian:** sees only the group conversation(s) and shared info for introductions explicitly shared with them. No browsing, no search, no matching. Displayed as "Verified Guardian (relationship declared by the user and confirmed by the guardian)" per Decision #9.
- **Admin:** everything in the Admin Dashboard, but RLS explicitly blocks admins from personal finance data and private assistant chats; conversation access only through a moderation view tied to flags/reports, and that access is itself audit-logged.
- **Super admin:** admin management + system settings.

**Why:** The guardian model is the platform's most unusual permission shape — "access by explicit share only" — so it gets its own tables (guardian_invitations, guardian_access) rather than being bolted onto normal permissions. Admin restrictions honor the PRD's promise that admins never see personal finances.

---

## 8. AI Services (Provider-Agnostic AI Provider Layer)

**Decision:** All AI work flows through two layers:

1. **AI Gateway Edge Function** — the single entry point, with internal task types: `moderate_message`, `transcribe_voice`, `moderate_media`, `assistant_chat`, `conversation_summary`, `profile_coach`, `compatibility_explain`, `photo_review`, `finance_insight`. It handles the platform concerns: per-tier rate limits (from settings), usage logging (feeds the AI Dashboard), prompt templates stored in the database (versioned, editable without redeploy), and Arabic + English support in every prompt.
2. **AI Provider Layer** — a small internal contract (roughly: "given a prompt/task, return a completion or a moderation verdict") with one **adapter per provider**. OpenAI is the first adapter. Anthropic, Gemini, or others are added later by writing a new adapter only — no business logic changes. A `settings` entry maps each task type to a provider/model (e.g., moderation on a fast cheap model, assistant chat on a stronger one), so admins can switch providers per task without redeploying. An optional fallback provider can be configured for when the primary is down (moderation still stays fail-closed if *all* providers are unavailable).

**What it means:** The rest of the codebase never says "call OpenAI." It says "run the moderation task," and the provider layer decides which company's AI actually answers. Swapping or adding AI vendors becomes a configuration change plus one adapter file.

**Why (provider-agnostic):** AI pricing, quality, and availability shift quickly; Arabic-language quality in particular varies by provider. Locking business logic to one vendor would make every future switch a rewrite. The adapter pattern makes vendor choice a business decision instead of an engineering project.

Compatibility scoring is a **hybrid**: a deterministic weighted algorithm in Postgres/Edge Function computes the sub-scores (cheap, explainable, runs daily); the AI model is used only to generate the human-readable "Why This Match?" explanation from those scores.

**Recommendation system (Official Decision):** curated quality over quantity — never endless browsing. The engine filters all compatible users, ranks by compatibility, and serves only the best candidates as tiered **daily new recommendations**: Free 10 / Serious 25 / Marriage Plus 50 (all admin-configurable). Each recommendation renders a **Compatibility Card**: overall %, breakdown (Religion, Values, Personality, Marriage Goals, Lifestyle, Distance, …), and a short AI explanation. **Marriage Plus refresh:** the current list can be *replaced* with different high-quality profiles on demand (daily refresh count admin-configurable) — replacement, not additional browsing. **Recommendation History** (today, previous days, saved, viewed, declined) is paid-tier only; Free users have no history access. Daily limits count only *new* recommendations; history access doesn't consume them. The engine avoids repeating profiles unless they remain among the user's strongest matches (tracked via a served-recommendations log).

**Why (hybrid scoring):** Calling an LLM for every daily compatibility calculation across all user pairs would be ruinously expensive and slow. The hybrid keeps costs linear and scores consistent, while still delivering the PRD's signature explanation feature. Central gating makes the admin-configurable AI limits real.

---

## 9. Chat & Moderation

**Decision (updated by the official Communication Stages & Media Rules — Decisions Part D):** Messages support four media types — **text, voice, image, video** — each with its own Edge Function, all sharing one moderation gate. No client can ever insert a message directly; these four functions are the only writers. The pipelines:

- **Text** — `send-text-message`: client → checks (stage, limits, subscription) → pre-filter → AI moderation → **only if approved**, insert into `messages` → Supabase Realtime delivers.
- **Voice** — `send-voice-message`: record → upload to the private `chat-voice` bucket → speech-to-text transcription (`transcribe_voice`) → AI moderation of the transcript (`moderate_message`) → approved delivers the voice message / blocked rejects it with an explanation. **Transcription OR moderation failure = not delivered.**
- **Image / Video** — `send-image-message` / `send-video-message`: upload to the private `chat-images` / `chat-videos` bucket → AI media moderation (`moderate_media`) → approved delivers / blocked rejects. Moderation failure = not delivered.

Every communication request, whatever its type, must validate permissions, validate journey stage, apply rate limits, run AI moderation, store the moderation result, deliver only after approval, and broadcast via Realtime.

- Clients have **no INSERT permission** on the messages table. Ever.
- **Fail-closed** (Decision #12): if moderation (or, for voice, transcription) is unavailable, the message is not delivered; user sees "moderation temporarily unavailable, try again."
- Blocked attempts are stored in `message_moderation` (for the escalation ladder and admin review) but do **not** consume the intro-message quota — only delivered messages count.
- **Media permitted per stage (Part D):** Introduction = text only; Serious = text + unlimited voice; Family = text + voice + images/videos (defaults 3 images/day, 2 videos/day, admin-configurable); Married = all types, no limits.
- **Moderation strictness per stage (Part D):** Introduction & Serious block contact-info, external communication, and inappropriate content; Family **stops** blocking contact info / social media / meeting arrangements but still blocks abuse, harassment, threats, blackmail, fraud, scams, hate speech, explicit content, and illegal content; Married moderates for safety only (abuse, harassment, threats, fraud, scams, illegal, explicit sexual content).
- Violation escalation (block → warning → temp suspension → admin review) is tracked per user in the database; severe categories trigger immediate admin flagging.
- A fast, cheap **pre-filter** (regex/pattern checks for phone numbers, links, handles in both scripts, including spaced/obfuscated digits) runs before the LLM call, on text messages and voice transcripts, to cut cost and latency.

**Why:** This is the platform's most security-sensitive flow. Removing client INSERT rights and forcing every media type through the same gate makes "bypass moderation" structurally impossible rather than merely forbidden — voice cannot skip via audio, and images/videos cannot skip via upload.

---

## 10. Payments (Provider-Agnostic)

**Decision:** Subscription business logic (plans, pricing, activation, renewal, expiry, grace periods, coupons) lives in **one gateway-independent subscription module**. It talks only to a **payment adapter interface** — a small contract every provider must implement (roughly: create payment, confirm payment, handle callback, refund placeholder). Two families of adapters exist:

1. **Automatic (gateway adapters):** **Areeba is the first Lebanese card gateway adapter** for Visa/Mastercard/Apple Pay/Google Pay. Flow: create checkout → user pays on gateway page → gateway webhook (signature-verified) hits `payment-webhook` → subscription auto-activates. Recurring billing where the gateway supports it. **We never touch or store card numbers** — the gateway does. Adding Stripe, a regional gateway, or a replacement for Areeba later = writing one new adapter; the subscription module doesn't change.
2. **Manual (Lebanon adapters):** OMT, Whish, Bank Transfer — each implemented as a manual adapter. Flow: user gets instructions + unique reference code → pays offline → submits reference number and receipt photo → claim appears in Admin payments queue → admin approves → the **same** subscription module activates the plan, with full audit trail. Pending claims expire after a configurable period (cleanup handled by a scheduled job, §21).
3. **"Can't pay? Contact us"** creates a support ticket that admins can convert into a manual activation — again through the same subscription module.

**What it means:** Whether money arrives by card, OMT, bank transfer, or admin approval, the exact same code activates the subscription. Payment providers are interchangeable plugs; the socket never changes.

**Why:** Decision #11 upgraded payments from placeholder to real. Lebanon's reality is that much money moves through OMT/Whish, which have no webhooks — so a clean manual-claim workflow is a first-class adapter, not a hack. Keeping subscription logic gateway-independent means switching or adding gateways never risks breaking activations, renewals, or coupons.

---

## 11. Finance Module

**Decision:**
- Tier gating per Decision #17: Free = add income/expenses + simple history; Serious = charts, budgets, goals, reports, AI insights; Marriage Plus = Couple/Shared Finance and advanced tools.
- **Shared Finance ruling (now official):**
  - Shared Finance requires **both users to be in the Married Stage** — no exceptions.
  - **Basic shared finance** (shared income/expense visibility and simple shared history) is **admin-configurable**: the administrator decides which tier(s) may access it via a settings entry.
  - **Advanced couple finance** (shared budgets, shared goals, joint reports, financial-compatibility analysis, long-term planning tools) is **always Marriage Plus** — this gate is fixed, not configurable.
- Amounts are stored in their **original currency**; an `exchange_rates` table is refreshed automatically from a rate service; conversion to the user's preferred currency happens at read time. Historical reports snapshot the rate used.
- Shared Finance requires recorded consent from both users; either may disconnect at any time; termination of the match auto-disconnects it (Decision #13).

**Why:** Storing original amounts + converting on display is the only sane approach with a volatile LBP — converting at entry time silently corrupts history. Consent records protect users and the platform. Splitting shared finance into a configurable basic layer and a fixed Marriage Plus advanced layer resolves the earlier Decision #4 vs. #17 tension cleanly: the *stage* gate (Married) is about trust and consent; the *tier* gate (Marriage Plus) is about premium tooling.

---

## 12. Storage, Media & Privacy

**Decision:** Six private Supabase Storage buckets, all access via short-lived **signed URLs** issued by the server after a permission check:

- `profile-photos` — on upload of a woman's photo, the server generates a **blurred thumbnail**; unauthorized viewers are only ever sent the blurred file's URL. The original's URL is never delivered to a client that fails the check (paid tier **AND** her privacy mode — Decision #6; her setting always wins). All photos pass AI modesty review + manual review queue before going live.
- `identity-documents` — encrypted, admin-only access (each access logged), **auto-deleted after successful verification** unless law requires retention (Decision #15).
- `payment-receipts` — user + admin access only.
- `chat-voice`, `chat-images`, `chat-videos` (Decisions Part D) — conversation media. Files land here only via the `send-voice-message` / `send-image-message` / `send-video-message` Edge Functions after stage + limit + permission checks; the raw file is delivered only after AI moderation approves it, and only to conversation participants via short-lived signed URLs. Voice audio is transcribed and the transcript moderated **before** the audio is ever delivered.

**What it means:** Privacy is enforced by *which file the server gives you*, not by CSS blur (which is trivially removed in browser dev tools).

**Why:** A single leaked photo of a woman who chose privacy would destroy the platform's core promise. Server-side enforcement is non-negotiable.

---

## 13. Admin System

**Decision:** The Admin Dashboard is a role-gated section of the same app (separate routes/layout, same codebase). Every admin capability maps to either a `settings` row (prices, limits, min age, cooldowns, feature flags, Wali behavior, moderation strictness) or an admin Edge Function (approve payment, review verification, suspend user, override moderation). Every action writes an immutable audit log with before/after values. Analytics are computed via aggregate views that structurally cannot return personal finance or message content.

**Why:** "Operate the platform without developers" (PRD Part 12) is achieved by making configuration data, not code. Immutable audit logs are required by the PRD and protect admins as much as users.

---

## 14. Security

**Decision (the non-negotiables):**
- RLS on **every** table; deny-by-default.
- All secrets in Edge Function environment; zero secrets in the frontend bundle.
- Webhook signature verification on all payment callbacks.
- Rate limiting (login, messages, AI, interest requests, uploads) enforced server-side with settings-driven values.
- Fail-closed moderation; fail-closed photo access (if the permission check errors, show blurred).
- Fraud signals (multi-account, device/IP abuse, repeated verification failures) logged into an internal risk score visible only to admins; never used to discriminate on protected characteristics (PRD rule).
- HTTPS everywhere; encrypted-at-rest for identity documents; sessions expire per configurable inactivity.

**Why:** The threat model here isn't abstract — it's harassers trying to bypass moderation, scrapers trying to harvest women's photos, and fraudsters gaming manual payments. Each control above maps to one of those.

---

## 15. API / Service-Layer Structure

**Decision:** Two service layers, mirrored:
- **Frontend `/services`** — one file per domain (`authService`, `profileService`, `matchService`, `chatService`, `financeService`, `assistantService`, `subscriptionService`, `adminService`, `guardianService`). Components import only these; they return typed results validated with Zod.
- **Backend Edge Functions** — organized by the same domains, RESTful in spirit (`/interests`, `/messages`, `/subscriptions`…), thin handlers calling shared business-logic modules (limits, stage rules, moderation client) so rules exist once.

**Why:** When the day comes to change something (a limit rule, a gateway), it changes in one shared module — not in twelve components. This is the PRD's "thin controllers, logic in services" made concrete.

---

## 16. Folder Structure

See the recommended structure at the end of this document.

**Why:** Feature-based folders keep each pillar (Match, Finance, Assistant) self-contained, matching the PRD's modularity rule and making it easy for future developers (or AI tools) to work on one module without breaking others.

---

## 17. State Management

**Decision:**
- **Server state** (profiles, matches, messages, finance): TanStack React Query — caching, refetching, optimistic updates.
- **Realtime**: Supabase Realtime subscriptions push new messages/notifications into the React Query cache.
- **Global client state** (session, role, language/direction, journey stage): small React Contexts.
- **Form state**: React Hook Form + Zod. No Redux.

**What it means:** We don't hand-manage a giant global store. React Query keeps server data fresh; Context holds only the handful of truly global values.

**Why:** 90% of this app's state is "data from the server" — React Query is purpose-built for that and eliminates whole categories of caching bugs. Redux would add ceremony with no benefit here.

---

## 18. Arabic / English Localization

**Decision:**
- i18next with JSON dictionaries (`en.json`, `ar.json`); zero hardcoded user-facing strings (enforced by review/lint).
- Direction switches via `dir="rtl"` on the root; layout built with **Tailwind logical properties** (`ms-`, `me-`, `ps-`, `pe-`) instead of `left/right`, so RTL works without duplicate CSS.
- Professional Modern Standard Arabic for UI copy; a quality Arabic font (e.g., IBM Plex Sans Arabic) paired with the Latin font.
- Locale-aware numbers, dates, and currency formatting; charts flip axes/legends correctly in RTL.
- AI prompts instruct the model to respond in the user's active language.

**Why:** RTL retrofitting is one of the most expensive mistakes a bilingual app can make. Using logical properties from the first component makes Arabic a first-class citizen, as the PRD demands, at near-zero extra cost.

---

## 19. Deployment & Scalability

**Decision:**
- Frontend on Vercel or Netlify (static hosting + CDN). Backend entirely on Supabase.
- Three environments: development, staging, production — each with its own Supabase project and secrets.
- CI pipeline runs type checks, lint, and tests before any deploy; database changes only via versioned migration files.
- Monitoring and alerting per the centralized observability strategy (§22); scheduled jobs run via the scheduler (§21).
- Scale path: Postgres indexes on hot queries (matches, messages, notifications), pagination everywhere, pre-computed daily recommendations (batch job, not on-page-load), and the AI pre-filter to cap LLM spend. Supabase tiers carry us to the 100k-user mark; beyond that the service-layer design lets us peel functions off without a rewrite.

**Why:** Separate environments and migrations are what make "production-ready MVP" (Decision #16) true rather than aspirational. The batch-computed recommendations decision is what keeps the daily-matching feature affordable.

---

## 20. Notification Service

**Decision:** A dedicated, event-driven Notification Service:

- **Event-driven core:** features never send notifications themselves. They emit an **event** (e.g., `interest.accepted`, `guardian.invited`, `payment.approved`, `moderation.warning`, `stage.married`, `reminder.success_story`) into a `notification_events` table. The `notification-dispatch` function picks events up, applies the user's preferences, quiet hours, and digest mode, then delivers through channel adapters.
- **Channel adapters:** `in_app` is the only live channel in the MVP (a `notifications` table + Supabase Realtime so they appear instantly). `email`, `sms`, `whatsapp`, and `push` are defined as adapter slots now and switched on later — same pattern as payments and AI providers.
- **Templates in the database:** every notification type has an editable, bilingual (EN/AR) template, so admins change wording without a deploy (matches the PRD's email/notification template requirement).
- Covered triggers include match updates, interest requests, guardian invitations, meeting reminders, payment status changes, moderation warnings, verification results, subscription expiry reminders, marriage-stage reminders, and success-story invitations (Decision #4).

**What it means:** There is one post office for the whole platform. Features drop a letter in the box; the post office decides how, when, and whether to deliver it based on what the user asked for.

**Why:** Scattering notification code across features guarantees inconsistency (some respect quiet hours, some don't) and makes adding SMS/WhatsApp later a hunt through the whole codebase. One service, many channel adapters keeps the PRD's "no spam, respect preferences" promise enforceable in exactly one place.

---

## 21. Background Jobs / Scheduler

**Decision:** Use Supabase's Postgres scheduler (`pg_cron`) to trigger scheduled Edge Functions. Jobs are registered in a `scheduled_jobs` table (name, schedule, enabled flag, last run, last result) so admins can see and toggle them. Initial jobs:

| Job | Schedule (typical) | Purpose |
|---|---|---|
| Daily match generation | Nightly | Pre-compute Today's Best Matches per user (keeps pages fast, AI costs batched) |
| Conversation summaries | Per threshold/daily | Generate paid-tier summaries when message counts hit the configured interval |
| Reminders | Daily | Subscription expiry (7/3/1 day), profile completion, journey nudges, marriage reminders |
| Monthly finance reports | Monthly | Generate AI finance reports for eligible tiers |
| Analytics aggregation | Hourly/daily | Roll raw events up into the dashboard numbers |
| Expired payment claims | Daily | Auto-expire stale OMT/Whish/bank claims |
| Document cleanup | Daily | Delete identity documents after successful verification (Decision #15) |
| Notification digests | Daily/weekly | Send digest-mode summaries |

Every job must be **idempotent** — safe to run twice without duplicating reports, reminders, or deletions — and must log its outcome.

**What it means:** Some work shouldn't wait for a user to click something. The scheduler is the platform's alarm clock: it wakes up specific functions on a timetable.

**Why:** Daily recommendations, retention-law document deletion, and expiry reminders are all *time-based* requirements from the PRD and decisions — without a scheduler they simply can't exist. Idempotency matters because schedulers occasionally double-fire, and "the user got billed-reminded twice" is annoying while "the document got deleted twice" must be harmless.

---

## 22. Centralized Logging, Monitoring & Error Reporting

**Decision:** One observability approach with clearly separated log streams:

- **App/system errors:** an error-tracking service (e.g., Sentry) for both frontend and Edge Functions, with alerts.
- **AI usage logs:** every AI call records task type, provider/model, latency, token/cost estimate, and outcome — this *is* the data behind the PRD's AI Dashboard.
- **Payment logs:** every gateway call, webhook, manual claim, approval, and activation — append-only.
- **Moderation logs:** every verdict (approved/blocked/rewritten), category, and escalation step — feeds the violation ladder and admin moderation view.
- **Admin audit logs:** immutable before/after records of every admin action (already in §13; part of the same strategy).
- **Health monitoring:** uptime and alerting on the pipelines whose failure silently breaks the product: moderation availability (moderation down = messaging down by design), payment webhooks, scheduled jobs that miss their run, and AI provider errors/fallbacks.

Logs never store message content or personal financial details beyond what each purpose strictly requires (PRD: don't log sensitive data unnecessarily).

**What it means:** When something breaks — and something always breaks — we find out from a dashboard and an alert, not from an angry user three days later. Each kind of event has one well-known home.

**Why:** This platform has three "invisible failure" traps: moderation outages block all chat, webhook failures leave paying users unactivated, and missed jobs skip legally required document deletion. Monitoring is the only defense against failures that don't throw a visible error in anyone's face.

---

## 23. Backup & Disaster Recovery

**Decision:**

- **Database:** Supabase automated daily backups with point-in-time recovery enabled on production, plus a periodic exported dump stored outside Supabase (separate cloud storage account) for provider-level disaster protection.
- **Storage buckets:** scheduled replication of `profile-photos` and `payment-receipts` to secondary storage. `identity-documents` are deliberately **excluded** from long-term backups — they're meant to be deleted after verification (Decision #15), and backing them up would violate that promise; only short-lived operational recovery applies.
- **Configuration & migrations:** all schema changes live in versioned migration files in git; every migration ships with a rollback (down) path or a documented recovery note when rollback is impossible. The `settings` table (all admin configuration) is included in backups and also exported with the periodic dump.
- **Recovery plan (documented in `/docs`):** who is contacted, how to restore the database to a point in time, how to re-point the frontend, how to verify integrity after restore (auth works, RLS intact, payments queue consistent), and target objectives — restore within hours, lose at most minutes-to-hours of data (tightened as the platform grows).
- Restores are **rehearsed on staging** on a regular schedule — an untested backup is a hope, not a plan.

**What it means:** If the database is corrupted, a migration goes wrong, or the provider has an outage, we have copies of everything important, a written procedure to bring the platform back, and proof (from rehearsals) that the procedure actually works.

**Why:** This platform will hold marriage histories, financial records, and payment trails — data users cannot recreate. The PRD requires backups and a documented recovery process; the identity-document exclusion is the one place where *not* backing up is the correct privacy decision.

---

## 24. Main Risks & How We Avoid Them

| Risk | Mitigation baked into this architecture |
|---|---|
| **Women's photo leakage** | Server-side blurred variants + signed URLs + no original URL ever sent to unauthorized clients; fail-closed on errors. |
| **Moderation bypass** | Clients cannot INSERT messages; single pipeline; fail-closed when AI is down. |
| **AI cost explosion** | Hybrid scoring (LLM only for explanations), regex pre-filter before moderation LLM calls, per-tier limits in settings, usage dashboard from day one. |
| **Chat latency from moderation** | Pre-filter handles most checks in milliseconds; optimistic "sending…" UI; monitor p95 moderation time. |
| **Manual-payment fraud** | Unique reference codes, receipt upload, admin approval queue, expiry on claims, full audit trail. |
| **LBP volatility corrupting finances** | Original-currency storage + snapshotted rates on reports. |
| **Journey-state bugs** | One enum column, transitions only via one Edge Function, transition history table. |
| **Guardian impersonation** | Email+phone verification, explicit authorization declaration, honest labeling (platform never claims to verify the relationship), woman controls all sharing. |
| **Scope creep** | Three pillars only; everything else behind feature flags marked future; settings-driven config avoids "quick hardcode" temptations. |
| **Vendor lock-in (Supabase / AI / payments)** | Service layer isolates Supabase calls; standard Postgres + migrations keep the database portable; AI Provider Layer (§8) and payment adapters (§10) make vendors swappable by configuration + one adapter file. |
| **Silent job failures** (missed deletions, reminders, reports) | Scheduled-jobs registry with last-run status, idempotent jobs, and alerts on missed runs (§21–22). |
| **Notification spam / inconsistency** | Single event-driven Notification Service enforcing preferences, quiet hours, and digests in one place (§20). |
| **Data loss / bad migration** | Point-in-time recovery, external dumps, migration rollback paths, rehearsed restores (§23). |

---

## Recommended Folder Structure

```
marriage-platform/
├── src/
│   ├── app/                     # App entry, router, providers, guards
│   ├── components/              # Shared design system (Button, Card, Modal, Badge, Skeleton, charts)
│   ├── features/
│   │   ├── auth/                # Login, register, phone verification
│   │   ├── onboarding/          # Profile wizard, questionnaires
│   │   ├── verification/        # ID upload, selfie, status
│   │   ├── match/               # Recommendations, profile cards, Why This Match, filters, interests
│   │   ├── chat/                # Conversations, message UI, stage banners, counters
│   │   ├── journey/             # Journey tracker, stage transitions UI
│   │   ├── guardian/            # Invitations, guardian dashboard, group chat
│   │   ├── assistant/           # Marriage Assistant chat, history, suggested prompts
│   │   ├── finance/             # Dashboard, income/expenses, goals, budgets, reports, shared finance
│   │   ├── subscription/        # Plans, comparison page, checkout, manual payment claims
│   │   ├── notifications/       # Notification center, preferences, quiet hours
│   │   ├── profile/             # Own profile view/edit, privacy settings
│   │   └── admin/               # All admin sections (users, payments, verification, AI, analytics, settings, audit)
│   ├── services/                # Frontend service layer (one file per domain)
│   ├── hooks/                   # Shared hooks (useAuth, useJourneyStage, useSettings, useDirection)
│   ├── contexts/                # Session, Language, Theme contexts
│   ├── lib/                     # Supabase client, query client, helpers
│   ├── types/                   # Shared TypeScript types (DB types, domain types)
│   ├── i18n/                    # en.json, ar.json, i18next setup
│   ├── utils/                   # Formatters (currency, dates), validators
│   └── assets/                  # Logo, illustrations, fonts
├── supabase/
│   ├── migrations/              # Versioned SQL migrations (schema + RLS policies)
│   ├── functions/               # Edge Functions
│   │   ├── _shared/             # Business logic modules shared by all functions
│   │   │   ├── ai-providers/    # AI Provider Layer: interface + openai adapter (+ anthropic, gemini later)
│   │   │   ├── payments/        # Subscription module + adapter interface + areeba, omt, whish, bank adapters
│   │   │   ├── notifications/   # Event handling, preference/quiet-hours logic, channel adapters (in_app now; email/sms/whatsapp/push later)
│   │   │   ├── limits/          # Tier + settings-driven limit checks
│   │   │   ├── stage-rules/     # Journey state machine rules
│   │   │   └── logging/         # Structured logging helpers per log stream
│   │   ├── send-text-message/
│   │   ├── send-voice-message/
│   │   ├── send-image-message/
│   │   ├── send-video-message/
│   │   ├── send-interest/
│   │   ├── stage-transition/
│   │   ├── ai-gateway/
│   │   ├── compatibility-engine/
│   │   ├── verify-identity/
│   │   ├── payment-webhook/
│   │   ├── manual-payment-claim/
│   │   ├── guardian-invite/
│   │   ├── notification-dispatch/
│   │   ├── jobs/                # Scheduled job functions (daily-matches, reminders, reports, analytics-rollup, claim-expiry, document-cleanup, digests)
│   │   └── admin-actions/
│   └── seed/                    # Default settings, categories, translations seed data
├── tests/                       # Unit, integration, e2e
├── .env.example                 # Documented env vars (no secrets committed)
└── docs/                        # This document, PRD, decisions log, roadmap
```

---

**All previously open items are now resolved.** The Shared Finance rule is official (§11): Married Stage required for both users; basic shared finance tier access is admin-configurable; advanced couple finance is fixed to Marriage Plus.

**Next step: Create the implementation roadmap.**
