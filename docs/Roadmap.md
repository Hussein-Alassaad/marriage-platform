# Implementation Roadmap — AI-Powered Marriage Platform
**Version 1.0 · Source of truth: Architecture Document v1.1 + PRD/SRS v4.0 + Official Decisions #1–#18**
**From empty repository → production release. No code in this document.**

---

## How this roadmap is optimized for Claude Code

- **Small, verifiable phases.** Each phase ends with something you can run, click, or query — Claude Code works best when every session has a testable finish line.
- **One `CLAUDE.md` at repo root** (created in Phase 1) summarizing: architecture rules (no business logic in components, no client INSERT on messages, all limits from settings, no hardcoded strings), folder conventions, and the current phase. Update it at the end of every phase so each new Claude Code session starts with correct context.
- **Migrations-first.** Every phase that touches data starts with its migration files, so the schema is always the source of truth Claude Code can read.
- **One commit message per phase** (given below), with smaller conventional commits inside phases (`feat:`, `fix:`, `chore:`).
- **Vertical slices after the foundation.** From Phase 4 onward, each phase delivers frontend + backend + DB for one domain, so nothing sits half-wired.

---

## Phase 1 — Project Foundation & Design System

**Objective:** A running, deployable app shell with the design language, bilingual RTL/LTR support, and tooling — before any feature exists.

**Features:** App shell, navigation (sidebar/topbar/bottom-nav responsive), language switcher, placeholder pages for all main routes, design system components.

- **Frontend:** Vite + React + TS strict + Tailwind; React Router with route skeleton (Home, Match, Finance, Assistant, Notifications, Profile, Admin, Guardian, Auth); design system (Button, Card, Input, Modal, Badge, Skeleton, EmptyState, PageHeader); emerald/off-white theme tokens; i18next with `en.json`/`ar.json` and `dir` switching using Tailwind logical properties; Arabic + Latin fonts.
- **Backend:** Create Supabase projects (dev/staging/prod); wire client; `.env.example`.
- **Database:** None (Phase 2).
- **AI:** None.
- **Security:** No secrets in repo; env handling; HTTPS-only hosting config.
- **Testing checklist:** App builds and deploys to staging; EN↔AR switch flips direction with no broken layouts; all routes render placeholders; lint + typecheck pass in CI.
- **Deliverables:** Deployed shell, design system, `CLAUDE.md`, CI pipeline.
- **Commit:** `feat: project foundation, design system, bilingual app shell`
- **Depends on:** Nothing.

---

## Phase 2 — Database Schema, RLS & Settings Engine

**Objective:** The complete core schema with deny-by-default RLS and the settings table that makes everything configurable.

**Features:** All core tables; settings engine; seed data; scheduler extension enabled.

- **Frontend:** Generated TS types from schema; `useSettings` hook reading public settings.
- **Backend:** Migration tooling; enable `pg_cron`; empty `scheduled_jobs` registry table.
- **Database:** Migrations for users/roles, profiles, photos, verification, matches (with canonical `stage` enum + `stage_history`), interests, conversations, messages (with a `type` enum: text/voice/image/video per Decisions Part D), message_moderation, subscriptions, payments, payment_claims, finance tables, assistant chats, guardians/invitations, notifications + notification_events, audit_logs, settings, coupons, support_tickets, exchange_rates. RLS: deny-by-default on every table, own-row policies for personal data. Seed: default settings (10 intro msgs, 5 free interests/day, summary interval 20, moderation=strict, cooldown 30d, min age, Family-stage media limits: 3 images/day + 2 videos/day), categories, plan definitions.
- **AI:** None.
- **Security:** RLS policy tests (user A cannot read user B's rows); no client write access to messages, subscriptions, payments, matches.
- **Testing checklist:** Migrations apply cleanly from zero; RLS test suite passes; seeds load; settings readable from frontend.
- **Deliverables:** Full schema + RLS + seeds under version control.
- **Commit:** `feat: core database schema, RLS policies, settings engine, seeds`
- **Depends on:** Phase 1.

---

## Phase 3 — Authentication, Roles & Route Guards

**Objective:** Real sign-up/sign-in with roles, gender-at-registration, and permission-aware routing.

**Features:** Register (with gender + DOB vs. configurable min age), login, email verification, phone OTP, session handling, role-based navigation (admin/guardian items), logout, password reset.

- **Frontend:** Auth pages; Session context; route guards (auth, role, verification-status); profile menu.
- **Backend:** Supabase Auth config; `user_roles` handling on signup; auth hooks to create profile row.
- **Database:** Triggers for user-row creation; min-age check against settings.
- **AI:** None.
- **Security:** Rate limits on login/OTP; session expiry per settings; server-side role checks (frontend guards are UX only); gender locked flag scaffold (enforced after verification in Phase 5).
- **Testing checklist:** Full signup→verify email→verify phone→login flow; under-age registration rejected per setting; guardian/admin nav appears only for those roles; RLS confirms role escalation impossible from client.
- **Deliverables:** Working auth for all four role types.
- **Commit:** `feat: authentication, roles, phone verification, route guards`
- **Depends on:** Phase 2.

---

## Phase 4 — Profile System & Onboarding

**Objective:** Complete multi-step marriage profile with privacy controls and profile quality scaffolding.

**Features:** Onboarding wizard (Personal → Education → Career → Marriage Goals → Lifestyle → Family Values → Financial Readiness → Privacy → Review), save-and-continue, own-profile page, privacy settings (including women's photo modes 1–4), photo upload (held for review), profile completion %.

- **Frontend:** Wizard with progress; RHF+Zod forms per step; profile view/edit; privacy settings UI.
- **Backend:** Profile service; photo upload to private bucket with "pending review" status; deterministic completion % calculation.
- **Database:** Profile field migrations finalized; photo status column; privacy settings columns.
- **AI:** None yet (photo AI review + profile coach arrive with the AI layer; manual review queue works meanwhile).
- **Security:** Photos land in private bucket only; no public URLs; salary/exact-address fields never exposed via RLS-checked views.
- **Testing checklist:** Wizard completes and resumes mid-way; completion % accurate; privacy modes persist; uploaded photo not visible to anyone while pending.
- **Deliverables:** Fully usable profile creation for men and women.
- **Commit:** `feat: marriage profile onboarding, privacy controls, photo upload`
- **Depends on:** Phase 3.

---

## Phase 5 — Identity Verification & Trust Gate

**Objective:** The mandatory verification gate: document + selfie upload, review queue, badges, and matchmaking lockout for unverified users.

**Features:** Verification flow (document type by country, upload, selfie capture), status tracking, admin review queue (first admin screen), badges, "verify to unlock matchmaking" prompts everywhere matchmaking is blocked.

- **Frontend:** Verification wizard; status page; badge components; gated-state UI.
- **Backend:** `verify-identity` function (stores encrypted, sets pending); admin approve/reject/request-again actions with audit logging; document deletion on approval (job wired in Phase 13, manual trigger now).
- **Database:** Verification tables finalized; `identity-documents` bucket with admin-only, logged access; gender-lock enforcement after verified.
- **AI:** Provider slot reserved for automated document/selfie checks (external IDV provider = mock adapter per Decision #16's mock-only-for-unintegrable rule).
- **Security:** Unverified users excluded from matching/interests/communication at RLS + function level; encrypted storage; access logging on document reads.
- **Testing checklist:** Unverified user cannot appear in or send anything matchmaking-related; admin approval grants badge and unlocks; rejected docs re-submittable; document access appears in audit log; gender change blocked post-verification.
- **Deliverables:** End-to-end verification workflow with admin queue.
- **Commit:** `feat: identity verification workflow, admin review queue, matchmaking gate`
- **Depends on:** Phase 4.

---

## Phase 6 — AI Provider Layer & AI Gateway

**Objective:** The provider-agnostic AI plumbing every later feature will use — built once, correctly.

**Features:** AI Provider interface + OpenAI adapter; `ai-gateway` function with task routing; prompt templates in DB; per-tier rate limiting from settings; AI usage logging; EN/AR support.

- **Frontend:** None user-facing; internal admin test console (admin-only page to run a task and see the response) for verification.
- **Backend:** `_shared/ai-providers/` (interface, OpenAI adapter, provider registry from settings); `ai-gateway` with task types registered (moderate_message, assistant_chat, conversation_summary, profile_coach, compatibility_explain, photo_review, finance_insight); fallback-provider config; fail-closed behavior.
- **Database:** `prompt_templates` (versioned), `ai_requests` log, task→provider/model settings.
- **AI:** First live prompts: `photo_review` (unblocks Phase 4's photo queue) and `profile_coach`.
- **Security:** Keys only in function env; per-user + per-tier rate limits; prompt-injection hygiene in templates; usage logs exclude raw sensitive content where not required.
- **Testing checklist:** Task call round-trips through the adapter; switching model via settings changes behavior without deploy; rate limit blocks correctly; provider-down path returns the fail-closed error; Arabic prompt returns Arabic output.
- **Deliverables:** Working AI gateway with logging and admin test console; photo review + profile coach live.
- **Commit:** `feat: provider-agnostic AI layer, AI gateway, prompt templates, usage logging`
- **Depends on:** Phase 2 (Phase 5 for tier gating context).

---

## Phase 7 — Matching Engine & Match Module

**Objective:** Daily AI-curated recommendations with explainable compatibility and the interest-request flow.

**Features:** Deterministic weighted compatibility engine (sub-scores + overall); daily recommendation generation job serving tiered *new* recommendations (Free 10 / Serious 25 / Plus 50, settings-driven); Compatibility Cards (overall %, breakdown by Religion/Values/Personality/Marriage Goals/Lifestyle/Distance, short AI explanation); Marriage Plus on-demand refresh (replaces the current list with different high-quality profiles; refresh count settings-driven); Recommendation History for paid tiers only (today, previous days, saved, viewed, declined); no-repeat logic via served-recommendations log (repeats allowed only for persistently strongest matches); Match page (Recommendations, Saved, Pending); profile cards with blur logic; Why This Match page; filters + smart search; send/accept/decline interest with AI-moderated intro note; 5/day free interest limit; 30-day re-request cooldown.

- **Frontend:** Match dashboard, profile card, other-user profile page (privacy-filtered), Why This Match page, filters/search, interest dialogs, saved profiles.
- **Backend:** `compatibility-engine`; daily-matches scheduled job (registered in `scheduled_jobs`); `send-interest` function enforcing verification, limits, cooldown, moderation of the note.
- **Database:** compatibility_scores, daily_recommendations (with served-recommendations log for no-repeat), recommendation history tables (paid-tier RLS), saved_profiles, viewed/declined tracking; indexes on hot queries; settings entries for tier daily counts and Plus refresh count.
- **AI:** `compatibility_explain` prompt live (Compatibility Card short explanation); moderation applied to interest notes.
- **Security:** Blurred-photo enforcement server-side via signed URLs (paid AND her mode); RLS ensures only allowed profile fields are readable; daily-count, refresh-count, and history-access gates enforced in DB/function, not UI.
- **Testing checklist:** Daily job produces exactly the tier's configured count of *new* recommendations (10/25/50 defaults); changing counts in settings takes effect next run without deploy; Plus refresh replaces the list (no additive browsing) and stops at the configured refresh limit; Free user cannot access Recommendation History (RLS-verified) while paid users see today/previous/saved/viewed/declined; no profile repeats except persistent top matches; scores deterministic and reproducible; free user blocked at 6th interest request; declined pair blocked for 30 days; free male user can never obtain an unblurred photo URL (verify via network tab); Compatibility Card renders %, breakdown, and explanation in both languages.
- **Deliverables:** Complete Match pillar through accepted interest.
- **Commit:** `feat: compatibility engine, daily recommendations, match module, interest flow`
- **Depends on:** Phases 5, 6.

---

## Phase 8 — Journey State Machine, Chat & Moderation (Introduction Stage)

**Objective:** The canonical stage system plus fully moderated introduction chat — the platform's most security-critical pipeline.

**Features:** `stage-transition` function (all stage changes + history); conversation created on interest acceptance; **text-only** Introduction chat (per Decisions Part D — no voice/image/video/attachments this stage) with 10/10 counters, 3-remaining warning, end-of-stage card; full moderation pipeline (regex/pattern pre-filter for contact info in both scripts → AI verdict → insert → Realtime); rewrite suggestions; violation escalation ladder; message reporting; journey tracker UI on dashboard and chat.

- **Frontend:** Chat UI (bubbles, counter, stage banner, warning cards, blocked-message explain/rewrite UX, report action); journey tracker component.
- **Backend:** `send-text-message` (checks → pre-filter → AI moderation → insert only if approved; fail-closed); violation tracking + escalation; moderation admin view scaffold. (Voice/image/video Edge Functions arrive in Phase 10 as later stages unlock those media types.)
- **Database:** Conversations/messages RLS (participants read-only; **no client INSERT**); moderation log; violation counters; triggers for message counting (blocked attempts don't consume quota).
- **AI:** `moderate_message` prompt (stage-aware rules, AR+EN, strict default from settings).
- **Security:** Verify by test that direct client insert to messages fails; fail-closed verified by disabling the AI provider in staging; contact-info pre-filter covers spaced/obfuscated digits, handles, links, Arabic-script numerals.
- **Testing checklist:** Accepted interest opens Introduction chat; counters accurate per person; contact-info attempts blocked with explanation + rewrite; 3rd violation triggers temp suspension; limit-reached shows respectful upgrade card; Realtime delivers approved messages instantly; summary NOT generated for free users.
- **Deliverables:** Working Introduction Stage end-to-end with unbypassable moderation.
- **Commit:** `feat: journey state machine, moderated introduction chat, violation system`
- **Depends on:** Phase 7.

---

## Phase 9 — Subscriptions & Payments (Provider-Agnostic)

**Objective:** Real monetization: plans, comparison page, Areeba card payments with auto-activation, and Lebanese manual payment claims.

**Features:** Plans/comparison page (from DB, "Most Popular"/"Best Value" tags); checkout; Areeba adapter (Visa/MC/Apple Pay/Google Pay) + signature-verified webhook auto-activation; OMT/Whish/Bank Transfer manual adapters (reference code, receipt upload, admin approval queue, expiry); "Can't pay? Contact us" → support ticket → manual activation; renewal reminders scaffold; coupons; tier enforcement wired into all existing gates (photos, summaries, limits).

- **Frontend:** Comparison page, checkout flow, manual-payment instructions + claim form, subscription status page, admin payments queue.
- **Backend:** `_shared/payments/` (subscription module + adapter interface + areeba/omt/whish/bank adapters); `payment-webhook`; `manual-payment-claim`; admin approval actions (audited).
- **Database:** subscriptions, payments, payment_claims finalized; coupon logic; receipt bucket policies.
- **AI:** None.
- **Security:** Webhook signature verification; no card data touches our systems; unique claim references; claim expiry; every activation audited; tier checks server-side everywhere.
- **Testing checklist:** Sandbox card payment auto-activates Serious tier and immediately unlocks photo access per privacy mode; manual claim → admin approve → activation; expired claim auto-closes (manual trigger until Phase 13); coupon math correct; downgrade on expiry re-locks features; "Can't pay" ticket reaches admin.
- **Deliverables:** Fully working monetization with both payment families.
- **Commit:** `feat: subscription system, Areeba gateway adapter, Lebanese manual payment claims`
- **Depends on:** Phase 8 (Phase 5 admin patterns).

---

## Phase 10 — Serious Communication, Family Stage & Married Stage

**Objective:** Complete the journey: paid unlimited chat with staged media (voice, images, videos), guardian workflow with group conversation, and marriage confirmation.

**Features:** Serious Communication (both completed intro + both opted in + both paid; **unlimited moderated text + unlimited voice messages**, images/videos still not allowed, contact info still blocked, Family-stage notice); **voice pipeline** (record → private `chat-voice` bucket → speech-to-text → transcript moderation → deliver; fail-closed if transcription **or** moderation fails); paid-tier conversation summaries (every 20 msgs, from settings); Wali invitation (relationship selection, email invite, code fallback); guardian account onboarding (email+phone required, IDV recommended, authorization declaration); guardian dashboard (introductions, notes, history — nothing else); 3-person Family group conversation with relaxed moderation (contact exchange + meeting arrangements allowed; abuse/threats/blackmail/scam/hate-speech/explicit/illegal still blocked) and **images/videos enabled with admin-configurable daily limits (default 3 images/day, 2 videos/day), each AI-moderated before delivery**; رؤية شرعية meeting suggestions + meeting planner; Married confirmation by both users (**all media types, no limits, safety-only moderation**); match termination flow (either side, everything disconnects, cooldown applies); success-story consent prompts scaffold.

- **Frontend:** Stage-aware chat banners; opt-in continuation dialog; voice recorder + player UI; image/video message UI with per-day limit indicators; guardian invite wizard; guardian dashboard; group chat UI; meeting planner; marriage confirmation flow; termination flow with confirmations.
- **Backend:** Stage-transition rules for all stages; `send-voice-message` (upload → transcribe → moderate transcript → deliver), `send-image-message` / `send-video-message` (upload → media moderation → deliver), all fail-closed and enforcing per-stage media permissions + daily limits; `guardian-invite`; group conversation creation; stage-aware moderation rule switching; termination cascade (access revocation, shared-feature disconnect).
- **Database:** guardian tables + access grants (explicit-share model); group conversation type; `messages.type` media rows referencing the private chat buckets; per-user daily media counters (image/video); `chat-voice` / `chat-images` / `chat-videos` buckets (private, signed-URL only); marriage confirmations; termination records.
- **AI:** Stage-aware moderation prompts; `transcribe_voice` + `moderate_media` tasks live; summary prompt live for paid tiers; family-meeting preparation suggestions via assistant task.
- **Security:** Clients never insert messages of any type; media served only to participants via short-lived signed URLs after moderation approval; voice audio withheld until its transcript passes moderation; Guardian RLS = explicitly shared data only, verified by tests; guardian labeled honestly ("relationship declared by the user…"); both-consent checks on marriage confirmation; termination immediately revokes conversation reads.
- **Testing checklist:** Free user blocked from Serious stage until subscribed; one-sided opt-in doesn't advance stage; guardian sees only shared introduction, cannot browse/search; contact info blocked in Serious but allowed in Family stage; **voice rejected when transcription/moderation fails (fail-closed) and a violating transcript is blocked with explanation; images/videos blocked before Family stage; Family media daily limits (3 images/2 videos) enforced server-side; Married stage allows all media with safety-only moderation**; both-confirm transitions to Married; termination locks both sides and starts cooldown.
- **Deliverables:** Full journey Introduction → Married, with guardian system.
- **Commit:** `feat: serious communication, guardian family stage, married stage, match termination`
- **Depends on:** Phase 9.

---

## Phase 11 — Marriage Assistant

**Objective:** The ChatGPT-style assistant pillar with tier limits, memory controls, and integration hooks.

**Features:** Assistant page (greeting, suggested prompts, history, quick actions); tier-limited daily conversations (settings-driven; Plus unlimited); capabilities per PRD (preparation guidance, compatibility explanation, profile coach, conversation coach on own conversation, wedding planning, platform FAQ); consent-based memory (view/delete/reset/disable); admin-configurable guidance mode (Islamic default per Decisions); safety refusals; shared assistant unlocked at Married stage.

- **Frontend:** Assistant chat UI with streaming-style rendering, history sidebar, memory management screen, limit indicators.
- **Backend:** `assistant_chat` task through the gateway; context assembly (profile, journey stage, own conversation summaries, finance summary where permitted); memory store with consent flags.
- **Database:** assistant_chats, assistant_memory (consent-flagged), usage counters.
- **AI:** Assistant system prompts (bilingual, guidance-mode aware, never-invent-facts, refer-to-professionals rules); conversation coach prompt.
- **Security:** Assistant reads only the requesting user's data (never the other person's private info); private chats invisible to admins; memory deletable; safety-rule refusal categories enforced in prompt + gateway.
- **Testing checklist:** Free-tier daily limit blocks at threshold; memory off = nothing persisted; Arabic conversations natural; assistant declines contact-info workarounds and unsafe requests; married couple sees shared assistant space with clear shared/private labeling.
- **Deliverables:** Complete Marriage Assistant pillar.
- **Commit:** `feat: marriage assistant with tier limits, consent-based memory, guidance modes`
- **Depends on:** Phases 6, 10 (for stage-aware features).

---

## Phase 12 — Finance Module

**Objective:** The Finance pillar: free basic tracking, Serious analytics, Marriage Plus advanced couple finance.

**Features:** Free: add income/expenses (multi-currency), simple history. Serious: dashboard cards, pie/line/bar charts, progress circles, budgets, savings goals (incl. wedding goal), monthly AI reports, AI insights, exports (PDF/Excel/CSV). Marriage Plus: advanced couple finance (shared budgets/goals/joint reports/financial compatibility). Shared Finance: Married Stage required for both, dual-consent activation, either-side disconnect; basic-shared tier access read from admin setting. Exchange-rate auto-updates; original-currency storage with display conversion and snapshotted report rates.

- **Frontend:** Finance dashboard (tier-aware), entry forms, charts (Recharts, RTL-correct), goals/budgets UI, shared workspace, consent + disconnect flows, export buttons.
- **Backend:** Finance service; report generation; exchange-rate fetch job (registered); export generation; shared-finance consent + disconnect logic (also triggered by termination).
- **Database:** Finance tables finalized; exchange_rates; consent records; RLS: strictly own or consented-shared rows; admin structurally blocked from personal finance (aggregate views only).
- **AI:** `finance_insight` + monthly report prompts (educational, never judging).
- **Security:** Verify admin cannot query personal finance; shared data gone from counterpart view after disconnect per policy; report rate snapshots immutable.
- **Testing checklist:** Free user sees history only (no charts); Serious unlocks charts/goals/reports; Plus couple in Married stage activates shared finance only after both consent; disconnect works from either side; LBP/USD conversion correct and historical reports stable when rates change; exports open correctly.
- **Deliverables:** Complete Finance pillar with tier + stage gating.
- **Commit:** `feat: finance module with tiered access, multi-currency, shared couple finance`
- **Depends on:** Phases 9, 10.

---

## Phase 13 — Notification Service & Background Jobs

**Objective:** The event-driven notification post office and the full scheduler suite (consolidating jobs introduced earlier).

**Features:** Notification events emitted from all domains (matches, interests, guardian, payments, moderation warnings, verification, subscription expiry, finance milestones, marriage + success-story reminders); `notification-dispatch` applying preferences, quiet hours, digest mode; in-app channel live (bell, grouped center, Realtime); channel adapter slots for email/SMS/WhatsApp/push (email may go live if provider available; otherwise adapter + mock per Decision #16); bilingual DB templates; preferences UI. Jobs registry completed: daily matches (from P7), summaries, reminders (7/3/1 expiry, journey nudges), monthly finance reports, analytics rollups, claim expiry, **document cleanup (automates Decision #15)**, digests — all idempotent, all logged.

- **Frontend:** Notification center, preferences page (categories, quiet hours, digest mode), unread badges.
- **Backend:** `_shared/notifications/`; dispatch function; retrofit event emission into Phases 5–12 flows; `jobs/` functions completed; `scheduled_jobs` admin visibility.
- **Database:** notification templates, preferences, quiet-hours config; job run logs.
- **AI:** Smart AI notification content task (e.g., "discussed careers but not finances") — rate-capped.
- **Security:** Preferences honored server-side; no notification leaks private content to lock screens beyond safe summaries; jobs idempotency tests.
- **Testing checklist:** Each trigger produces the right notification; quiet hours suppress and digest collects; double-running any job produces no duplicates; document-cleanup deletes verified IDs and logs it; missed-run status visible in registry.
- **Deliverables:** Complete notification system + full scheduler suite.
- **Commit:** `feat: event-driven notification service, channel adapters, scheduled jobs suite`
- **Depends on:** Phases 5–12 (retrofits events across them).

---

## Phase 14 — Admin Dashboard & Analytics Consolidation

**Objective:** One professional admin surface unifying the queues built earlier and adding settings management, analytics, and the AI dashboard.

**Features:** Admin sections per PRD (Overview/Users/Matches/Conversations-moderation/AI/Finance-aggregate/Subscriptions/Payments/Verification/Reports/Support/Analytics/Settings/Audit Logs); settings editor for every configurable value (limits, prices, min age, cooldowns, wali behavior, moderation strictness, feature flags, templates); user management (search/suspend/ban/reactivate); moderation review (flag-tied, access-audited); support ticket workflow; Analytics dashboard (user/match/communication/finance/subscription/verification/support metrics, exec summary, exports); AI Dashboard (usage, performance, moderation stats, cost estimates, safety monitoring); customizable layout persistence.

- **Frontend:** Full admin app section; charts; settings forms with validation; audit log viewer.
- **Backend:** `admin-actions` consolidated (all audited); aggregate analytics views/rollups; BI insight generation task.
- **Database:** Aggregate views structurally excluding message content and personal finance; layout persistence.
- **AI:** BI insights prompt ("Finance usage +18% this month" style).
- **Security:** Every admin mutation audit-logged with before/after; super-admin-only settings enforced; verify aggregate views cannot be joined back to personal financial data.
- **Testing checklist:** Changing a setting (e.g., intro limit 10→8) takes effect without deploy; suspension blocks login-time access appropriately; analytics match seeded test data; audit log immutable (update/delete attempts fail); admin cannot open an unflagged private conversation.
- **Deliverables:** Complete admin + analytics + AI dashboards.
- **Commit:** `feat: unified admin dashboard, analytics, AI dashboard, settings management`
- **Depends on:** Phase 13.

---

## Phase 15 — Observability, Backup/DR & Security Hardening

**Objective:** Production-grade operations: monitoring, alerting, backups, and a security pass.

**Features:** Error tracking (frontend + functions) with alerts; health monitors on the silent-failure traps (moderation availability, payment webhooks, missed jobs, AI provider errors); log-stream review (AI/payment/moderation/audit complete and content-minimal); backups: PITR on prod, external periodic dumps, storage replication (identity docs excluded), documented + staging-rehearsed recovery runbook; security hardening: full RLS audit, rate-limit review, dependency audit, signed-URL expiry review, penetration-style test pass on the four critical flows (photo access, message insert, payment activation, guardian access).

- **Frontend:** Error boundary polish; graceful degraded states (moderation-down banner, etc.).
- **Backend:** Alert wiring; dump/replication jobs; runbook in `/docs`.
- **Database:** PITR config; backup verification queries.
- **AI:** Fallback-provider drill (primary disabled in staging).
- **Security:** The hardening pass above; fix everything found before Phase 16.
- **Testing checklist:** Simulated moderation outage alerts within minutes and chat fails closed; staged restore completes per runbook with integrity checks passing; forced webhook failure alerts; attempted photo-URL scraping yields blurred/denied only.
- **Deliverables:** Monitored, backed-up, hardened platform; recovery runbook proven on staging.
- **Commit:** `chore: observability, alerting, backup/DR runbook, security hardening`
- **Depends on:** Phase 14.

---

## Phase 16 — Localization Completion, QA & Production Launch

**Objective:** Ship it: complete Arabic coverage, full-regression QA against the PRD launch checklist, and production release.

**Features:** 100% translation coverage audit (no hardcoded strings — lint-enforced); professional Arabic copy review; RTL visual QA on every screen; accessibility pass (WCAG 2.1 AA targets: keyboard, screen readers, contrast, focus); performance pass (sub-2s loads, image optimization, code splitting, skeletons); legal pages (Terms, Privacy, Community Rules) + account deletion/data export; full run of the PRD Launch Checklist (all 18 items); production environment go-live.

- **Frontend:** Translation completion; a11y and performance fixes; legal pages; final polish.
- **Backend:** Data export + deletion functions; production env config; final settings values.
- **Database:** Production migration run; final seed review; index review under load test.
- **AI:** Arabic output quality review across all prompts; moderation accuracy spot-check suite (bilingual test corpus of allowed/blocked messages).
- **Security:** Final secrets rotation; production RLS smoke tests; monitoring confirmed live on prod.
- **Testing checklist:** Every PRD launch-checklist item ticked with evidence; E2E suite green on staging and prod smoke; Lighthouse/perf targets met; two full user journeys (one EN, one AR) executed manually end-to-end: register → verify → match → introduce → subscribe → family stage → married → shared finance.
- **Deliverables:** **Production release v1.0.**
- **Commit:** `release: v1.0 production launch`
- **Depends on:** Phase 15.

---

## Dependency Map (summary)

```
P1 → P2 → P3 → P4 → P5 ─┬→ P7 → P8 → P9 → P10 ─┬→ P11 ─┐
                 P6 ─────┘                       └→ P12 ─┼→ P13 → P14 → P15 → P16
                 (P6 after P2, parallel-friendly)        ┘
```

Phases 11 and 12 can be built in parallel by separate sessions once Phase 10 is done.

---

**Roadmap complete. Stopping here — awaiting your approval before beginning Phase 1.**
