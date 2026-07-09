# Development Handbook — AI-Powered Marriage Platform
**Version 1.0 · Companion to: PRD.md, Implementation-Decisions.md, Architecture.md, Roadmap.md**

This handbook defines *how* we write, test, review, and ship code. The other documents define *what* we build. If this handbook ever conflicts with the Architecture or Official Decisions, those win.

---

# 1. Coding Standards

## 1.1 Folder Organization
- Follow the folder structure in Architecture §16 exactly. Do not invent new top-level folders without updating the Architecture document first.
- Feature code lives inside its feature folder (`src/features/chat/…`). If two features need the same thing, it moves to `src/components`, `src/hooks`, or `src/utils` — never copy-pasted.
- Edge Function business logic lives in `supabase/functions/_shared/`. Function entry folders stay thin.
- Rule of thumb: you should be able to delete a feature folder and break only that feature.

## 1.2 File Naming Conventions
- React components: `PascalCase.tsx` (`ProfileCard.tsx`). One main component per file.
- Hooks: `useCamelCase.ts` (`useJourneyStage.ts`).
- Services: `camelCaseService.ts` (`matchService.ts`).
- Utilities/types: `camelCase.ts` (`formatCurrency.ts`, `matchTypes.ts`).
- Edge Functions: `kebab-case` folders (`send-message/`).
- Migrations: timestamp-prefixed, descriptive: `20260705_add_recommendation_history.sql`.
- Translation keys: `feature.screen.element` (`chat.intro.limitWarning`) — never sentences as keys.

## 1.3 React Best Practices
- Functional components + hooks only. No class components.
- Components render; they do not fetch, calculate business rules, or talk to Supabase. They call hooks/services.
- Keep components under ~150 lines; extract subcomponents when they grow past that.
- Props are typed interfaces; avoid `any` and avoid passing whole objects when two fields will do.
- Derive state where possible instead of duplicating it (`messagesRemaining` is computed, not stored twice).
- Every list has a stable `key`; every async view has loading (Skeleton), empty (EmptyState), and error states — no blank screens (PRD requirement).

## 1.4 TypeScript Best Practices
- `strict: true` stays on forever. `any` is banned; use `unknown` + narrowing when truly needed.
- Database types are generated from the schema; domain types live in `src/types` and are the single source for each entity.
- All enums that mirror DB enums (journey stage, subscription tier, roles, moderation verdicts) are defined once and imported everywhere — never retyped as string literals inline.
- Zod schemas validate all external data: form input, Edge Function payloads, AI responses. Parse, don't trust.

## 1.5 Component Architecture
- Three layers: **pages** (route-level, compose features), **feature components** (domain UI), **design-system components** (generic, no domain knowledge).
- Design-system components never import from `features/`. Feature components never import from other features — shared needs go through the shared layers.
- Stage-gated or tier-gated UI always reads from `useJourneyStage` / subscription hooks — never re-implements the gate logic locally.

## 1.6 Service-Layer Architecture
- Components → hooks → services → Supabase/Edge Functions. Components never import the Supabase client directly.
- One service file per domain, mirroring the Edge Function domains (Architecture §15).
- Services return typed, Zod-validated results and normalized errors — never raw Supabase responses.
- Any operation with business rules (send message, send interest, transition stage, activate subscription) calls its Edge Function; services never try to replicate those rules client-side.

## 1.7 State Management
- Server state: TanStack React Query only — one query-key convention file, sensible `staleTime`, invalidate on mutation.
- Realtime events push into the React Query cache; they do not create a parallel state system.
- Global client state: small Contexts only (session, language/direction, theme). If you're reaching for a global store, first ask whether React Query already owns that data.
- Forms: React Hook Form + Zod. No manual `useState` form fields for multi-field forms.

## 1.8 Error Handling
- Every service call path handles failure. Users see friendly, translated messages; logs get technical details. Never `alert(error.message)`.
- Fail-closed rules from the Architecture are sacred: moderation unavailable → message not sent; photo permission check fails → blurred/denied. Never "fail open for better UX."
- Error boundaries wrap each major route section so one broken widget doesn't kill the app.
- Edge Functions return structured errors (code + safe message); never leak stack traces or SQL to clients.

## 1.9 Security Coding Practices (non-negotiable)
- No secrets in frontend code, ever. All keys live in Edge Function environment variables.
- Never add a client-side INSERT/UPDATE path to protected tables (messages, matches, subscriptions, payments, verification). If a feature "needs" one, the answer is a new Edge Function.
- Every new table ships with RLS policies in the same migration — deny-by-default, then explicit allows.
- Frontend permission checks are UX only; the same check must exist in RLS or the Edge Function.
- All limits, prices, and thresholds come from the `settings` table. Hardcoding a limit is a rejected PR.
- User-facing content from AI or other users is rendered as text, never as HTML.
- Signed URLs only for storage; never store or log a raw storage path where a client can see it.

## 1.10 Performance Guidelines
- Paginate every list (messages, notifications, history, admin tables). No unbounded queries.
- Code-split by route; lazy-load Admin, Guardian, and Finance charts.
- Images: compressed, sized variants, lazy-loaded.
- Expensive work (recommendations, reports, summaries) belongs in scheduled jobs, not page loads.
- Watch p95 of the send-message pipeline — moderation latency is the product's heartbeat.

## 1.11 Clean Code Principles
- Names say what things are (`introMessagesRemaining`, not `cnt`). Comments say *why*, not *what*.
- Functions do one thing; extract when a function needs a scroll.
- Delete dead code — git remembers it; the codebase shouldn't.
- Boy-scout rule, bounded: leave touched files slightly cleaner, but don't refactor unrelated code inside a feature PR.

---

# 2. Testing Strategy

## 2.1 Unit Testing
- Target: pure logic — compatibility scoring, limit calculations, currency conversion, message counting, stage-transition rules, formatters, Zod schemas.
- Tools: Vitest. Fast, isolated, no network.
- The compatibility engine and stage machine get exhaustive unit suites — they are deterministic by design (Architecture) precisely so they can be tested this way.

## 2.2 Integration Testing
- Target: Edge Functions against a local/test Supabase — the full path of `send-message`, `send-interest`, `stage-transition`, `payment-webhook`, `manual-payment-claim`, `guardian-invite`.
- **RLS test suite is mandatory and grows with every phase**: for each table, assert user A cannot read/write user B's rows, guardians see only shared data, admins cannot read personal finance or unflagged conversations, clients cannot insert messages.
- Payment tests use the gateway sandbox; webhook signature verification has explicit negative tests (bad signature → rejected).

## 2.3 End-to-End Testing
- Tool: Playwright. Core journeys automated by launch:
  1. Register → verify email/phone → onboard → ID verification (mock IDV) → appears in recommendations.
  2. Interest → accept → Introduction chat → limit reached → subscribe (sandbox) → Serious stage.
  3. Guardian invite → guardian onboarding → Family group chat → contact exchange allowed.
  4. Married confirmation → shared finance consent → shared workspace.
  5. Match termination → access revoked → cooldown enforced.
- Each journey runs in both English and Arabic (RTL) variants.

## 2.4 AI Testing
- **Moderation corpus:** a versioned bilingual test set of messages that must be BLOCKED (phone numbers plain/spaced/Arabic-numeral, handles, links, flirtation, abuse) and must be ALLOWED (normal marriage-topic conversation). Run against the moderation task after any prompt or provider change; track accuracy.
- Stage-awareness tests: the same "here's my number" message blocked in Introduction/Serious, allowed in Family stage.
- Voice/media moderation tests (Decisions Part D): a voice transcript is moderated with the same rules as text; a failed transcription or moderation call yields non-delivery (fail-closed); image/video moderation gates media before delivery; media type is rejected when the stage doesn't permit it (no voice in Introduction; no images/videos before Family); Family-stage daily media limits (default 3 images/2 videos) enforced server-side; Married stage applies safety-only moderation.
- Provider-layer tests: switching provider via settings changes execution; all-providers-down → fail-closed error.
- Golden-output review (manual): sample assistant, summary, and explanation outputs reviewed for tone, language quality (especially Arabic), and safety-rule compliance before each release.
- AI usage logging asserted: every gateway call produces a log row.

## 2.5 Security Testing
- Per phase: run the RLS suite + attempt the phase's "forbidden actions" directly against the API (not through UI).
- Standing red-team checks: obtain an unblurred photo URL as a free male user (must be impossible); insert a message client-side (must fail); replay a payment webhook (must be idempotent + verified); access another user's finance rows; guardian browsing beyond shared data.
- Dependency audit (`npm audit`/tooling) in CI; secrets scanning on every commit.

## 2.6 Performance Testing
- Before launch: load-test daily recommendation generation at target user counts, message pipeline p95 under concurrent chat, and admin analytics queries.
- Budgets: initial page load < 2s on staging hardware; send-message round trip acceptable p95 documented and monitored.

## 2.7 Regression Testing
- Full unit + integration + RLS suite runs in CI on every PR; E2E suite runs nightly and before any release.
- Every bug fixed gets a test that would have caught it — no exceptions.
- The moderation corpus is a permanent regression gate: prompts may not change unless the corpus still passes.

## 2.8 Manual Release Checklist (every production release)
1. All CI suites green; E2E green on staging.
2. Moderation corpus pass-rate at or above baseline.
3. One manual EN journey + one manual AR journey (full path) on staging.
4. New settings entries seeded on prod; migration dry-run reviewed.
5. PRD Launch Checklist items affected by this release re-verified.
6. Backups confirmed recent; rollback plan for this release written down.
7. Monitoring dashboards checked post-deploy for 30 minutes.

---

# 3. Development Rules

## 3.1 When to Create a Component
- Create when: UI is used twice, or a JSX block exceeds ~40 lines with its own concern, or it has its own loading/error states.
- Put it in the design system only if it has zero domain knowledge; otherwise it stays in the feature.
- Don't create single-use wrapper components "for the future." Extract when the second use appears.

## 3.2 When to Create a Service
- Any new Supabase table or Edge Function interaction goes through an existing domain service, or a new one if it's a new domain.
- If two components need the same query, that query becomes a hook backed by the service — never duplicated inline.
- Server-side: shared rules (limits, stage rules, notification emission) go in `_shared/` modules the first time two functions need them.

## 3.3 Refactoring Rules
- Refactor in dedicated commits/PRs, separate from feature changes.
- Never refactor and change behavior in one commit.
- A refactor requires existing tests passing before and after — if the area has no tests, write characterization tests first.
- Cross-phase refactors (touching earlier phases) require checking the Roadmap phase checklists still pass.

## 3.4 Documentation Requirements
- `CLAUDE.md` updated at the end of every phase (current phase, new conventions, gotchas discovered).
- Every Edge Function folder has a short README block in its entry file: purpose, inputs, side effects, settings it reads.
- Every migration has a header comment: what and why.
- New settings keys documented in a `docs/settings-registry.md` table (key, meaning, default, who reads it).
- Decisions that change the Architecture get written into Architecture.md *before* the code changes.

## 3.5 Code Review Checklist (every PR)
- [ ] Follows folder + naming conventions.
- [ ] No business logic in components; no direct Supabase calls from components.
- [ ] New tables have RLS in the same migration; forbidden-action test added.
- [ ] No hardcoded limits, prices, or user-facing strings (translations added for EN + AR).
- [ ] Loading/empty/error states present; RTL checked for new screens.
- [ ] Errors handled and translated; no leaked technical details.
- [ ] Tests added/updated; CI green.
- [ ] No secrets, no `any`, no dead code, no console noise.
- [ ] Audit logging for any new admin action; notification event emitted where the PRD expects one.

## 3.6 Feature Implementation Rules
- Implement in this order: migration + RLS → Edge Function/shared logic → service → hook → UI → tests → translations. Schema first, pixels last.
- A feature is "done" only when its Roadmap phase checklist items pass, both languages work, and its gates (tier/stage/verification) are enforced server-side.
- Any deviation from PRD/Decisions/Architecture requires an explicit note and approval *before* coding — never "adjust and mention later."

## 3.7 Rules to Avoid Technical Debt
- No TODOs without a linked issue.
- No copy-pasted logic — second occurrence forces extraction.
- No "temporary" client-side enforcement of a server rule.
- No skipped tests committed; a failing test blocks merge, not gets commented out.
- Mock adapters (IDV, future channels) must implement the real interface, so replacement is a swap, not a rewrite (per Decision #16).
- Feature flags for anything shipped dark; flags removed within two phases of full rollout.

## 3.8 Overall Development Workflow
1. Read the current Roadmap phase + relevant PRD/Decision sections.
2. Confirm scope; list the phase's forbidden actions (security tests to write).
3. Build in the feature order above, smallest vertical slice first.
4. Run phase testing checklist; update `CLAUDE.md`.
5. PR → review checklist → merge → deploy to staging → verify → phase commit.
6. Stop at phase boundary; get approval before the next phase (matches the Roadmap's gating).

---

# 4. Git Workflow

## 4.1 Branch Strategy
- `main` — always deployable; protected; only merges from `develop` (or hotfixes).
- `develop` — integration branch; deploys to staging automatically.
- `feature/phase{N}-{short-name}` — one per work item (e.g., `feature/phase8-moderation-pipeline`).
- `fix/{short-name}` for bugfixes; `hotfix/{short-name}` branches from `main` for production emergencies and merges back to both `main` and `develop`.
- Branches are short-lived (days, not weeks); rebase on `develop` before opening a PR.

## 4.2 Commit Message Conventions
- Conventional Commits: `type(scope): summary` — types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`.
- Scope = feature domain (`feat(chat): add stage banner`, `fix(payments): reject unsigned webhooks`).
- Imperative mood, ≤72-char subject; body explains *why* when non-obvious.
- Migrations and their code changes commit together; never a schema commit that leaves the app broken.

## 4.3 Phase Completion Workflow
1. All phase tasks merged into `develop`; phase testing checklist executed on staging with results noted in the PR.
2. `CLAUDE.md` and any touched docs updated.
3. Final phase commit uses the Roadmap's designated message (e.g., `feat: journey state machine, moderated introduction chat, violation system`).
4. Tag the merge to `main`: `phase-8-complete`.
5. Request approval before starting the next phase.

## 4.4 Versioning Strategy
- Semantic versioning: `MAJOR.MINOR.PATCH`.
- Pre-launch: `0.{phase}.{patch}` (Phase 9 complete → `0.9.0`).
- Production launch (Roadmap Phase 16) = `1.0.0`.
- After launch: MINOR for features, PATCH for fixes, MAJOR for breaking/product-level changes.

## 4.5 Release Workflow
1. Release branch `release/x.y.z` from `develop`; only fixes and translations land on it.
2. Run the Manual Release Checklist (§2.8) on staging.
3. Merge to `main`, tag `vX.Y.Z`, deploy production via CI.
4. Post-deploy: smoke tests + 30-minute monitoring watch; announce internally.
5. Rollback plan: redeploy previous tag + documented migration rollback path (Architecture §23). If a migration can't roll back, the release notes must say so *before* deploying.
6. Merge `main` back into `develop`.

---

*End of Development Handbook. This document is binding for all contributors and all Claude Code sessions on this project.*
