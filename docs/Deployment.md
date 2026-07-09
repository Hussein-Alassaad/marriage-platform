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

## 6. Pre-deploy checklist

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` all pass.
- [ ] `.env` is **not** committed (`git check-ignore .env` prints `.env`).
- [ ] `.env.example` contains placeholders only.
- [ ] Both `VITE_*` vars set in Vercel for Production + Preview.
- [ ] Home "backend status" badge reads **connected** once the vars are live.
- [ ] No `service_role` key anywhere in the repo or Vercel client env.
