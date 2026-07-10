# DESIGN_NOTES — MITHAQ Visual & Motion Overhaul

Log of adaptations made to fit the MITHAQ master prompt onto this codebase, and
anything intentionally skipped (with why). Behaviour, routing, state, services,
props, i18n strings and file locations are unchanged throughout.

## Adaptations (prompt → this repo)

- **TypeScript, not JSX.** The prompt references `.js` files; this project is
  strict TypeScript. All MITHAQ code is `.ts`/`.tsx`. `src/lib/motion.js` →
  extended the existing `src/lib/motion.ts` (kept old exports as aliases).
- **Tokens in `src/index.css`, not `src/styles/tokens.css`.** Tailwind v4 is
  CSS-first (`@theme` in `index.css`, no config file); a separate `tokens.css`
  would be an orphan. MITHAQ tokens were folded into `index.css` and mapped into
  Tailwind via `@theme`.
- **Legacy tokens re-pointed, not replaced.** Existing semantic names
  (`canvas/surface/raised/ink/ink-soft/muted/faint/line/line-strong`,
  `brand-50…900`, `shadow-xs/card/elevated/glow`) are preserved and re-pointed
  onto the MITHAQ palette, so every existing component adopted the new identity
  with near-zero per-component churn. MITHAQ-native tokens
  (`bg-0…4`, `text-1…4`, `border-1/2/accent`, `gold-*`, `*-wash`, `on-brand`,
  `radius-xs…pill`, `shadow-e1/e2/e3`) were added alongside.
- **Theme default unchanged (owner decision).** MITHAQ is dark-primary; the app
  keeps its existing default-selection logic (`prefers-color-scheme`) untouched.
  Both palettes are fully styled — dark = MITHAQ §2.1, light = MITHAQ §2.2.
- **Fonts via Google Fonts `<link>`** (Fraunces + Amiri) added to `index.html`;
  Inter + IBM Plex Sans Arabic continue to ship via `@fontsource`. No npm deps
  added except the already-present `framer-motion@^11`.

## Auth experience elevation (login as flagship)

- **Character physically pushes the card.** A shared `pushPhase` motion value
  drives both the character (lean + arm) and an under-damped `useSpring` on the
  card's x — the card recoils ~9px on contact then settles with a natural bounce.
  Desktop-only loop; paused under reduced motion and on small screens.
- **Premium 3D-style character** (`AuthMascot`): layered SVG radial gradients,
  rim light + soft blurred ground shadow, page-load entrance, continuous idle
  breathing. Accepts an optional `src` (transparent PNG / rendered 3D frame) that
  swaps the visual while keeping identical interactions — drop in a real asset later.
- **Cinematic depth, no WebGL** (deliberate perf choice — CSS/Framer match the
  look at a fraction of the GPU cost, and honour the low-end-device requirement):
  mesh-gradient wash + drifting aurora + geometric veil + low-count ambient motes
  (14, transform/opacity only, disabled under reduced motion).
- **Glass login card** via `.auth-card-glass` (blur + saturate + top sheen); the
  nested design-system Card is neutralised with a `:where()` reset so the form
  reads as one pane of glass — **no markup/logic/i18n change** in the auth pages.
- **Dedicated mobile layout** (`useMediaQuery`), not a shrink: smaller character
  greeting from the top (clear of the centred motto), full-width glass card,
  atmosphere preserved, no push loop (lighter on phones).
- Micro-interactions: magnetic sign-in button, traveling-light button ring,
  spring page/entrance transitions.

## Covenant Threshold sign-in scene

A cinematic auth scene: two dignified figures approach a glowing arched threshold
from their own sides toward a glass card. Never facing each other, never touching.

- **Characters**: `AuthCharacter` renders your art (`<img>`) when it loads, else a
  premium emerald **silhouette** (man / woman). Drop `char-man.png` / `char-woman.png`
  into **`public/auth/`** (transparent WebP/PNG) and they upgrade instantly — no code
  change. Each slides in from its own side, then breathes. RTL-aware (`flip` + `dx`).
  (I can't generate the art — produce it from the Part-A prompts in an image tool.)
- **Layers** (`src/features/auth/scene/`): `Starfield` (twinkle), `GeometricVeil`
  (mashrabiya lattice, reused), `AuroraBackground` (reused), `ArchedWindow` (gold light
  + lattice, blooms in), `Lantern` (drops in, sways + flickers), `TrustBar` (4 bilingual
  badges, stagger). All CSS/Framer — no WebGL — for 60fps on low-end devices.
- **Card**: arched glass (`rounded-[40px_40px_24px_24px]`, `.auth-card-glass`) with
  emerald edge-glow; in-card header, Fraunces H1 word-reveal, `AuthField` dark-glass
  fields (leading icon, theme-aware via `color-mix`, focus glow, error shake, password
  eye toggle, valid check), full-width gradient button with loading spinner → success
  check → **ConfettiBurst on successful sign-in** (Barakah, reduced-motion-safe).
- **Choreography**: staggered entrance timeline (lantern → window → card → figures →
  fields → trust bar), idle loops, pointer parallax at layered depths (desktop only),
  and a one-time "homage nudge" on the card as the figures arrive.
- **Mobile** (`useMediaQuery`): dedicated — card is the hero (full-width), figures
  shrink to the bottom corners peeking behind the trust bar, lantern top-center,
  parallax off. Not a shrink of desktop.
- Auth logic / routes / validation / i18n untouched; new trust copy added as bilingual
  `auth.trust.*` keys. `AuthMascot` (previous single character) is now superseded.

## Skipped / deferred (with reason)

- **§5.2–5.8 feature pages don't exist yet.** Match, Finance, Assistant,
  Notifications, Profile, Admin and Guardian are currently `ComingSoon`
  placeholders (their features are future build phases). The MITHAQ page specs
  describe fully-built screens; building match cards, finance tables, chat, etc.
  would be **adding features**, which the guardrails forbid ("keep all content").
  What was done instead: the design system + full motion kit are in place, and
  the placeholders inherit the MITHAQ palette/typography automatically — so those
  pages will land on MITHAQ the moment their real UI is built. Restyled in depth:
  **Home** (§5.1) and **Auth** (§5.9), plus every shared component (§4).
- **Sidebar "ROLE VIEWS" section label (§4.4) omitted.** It would introduce new
  user-visible copy with no existing i18n key; the guardrails forbid adding/editing
  strings. The role group keeps its divider instead.
- **Toast, Toggle switch, Tabs, Table (§4.3/4.8/4.10/4.11)** not added as new
  components — nothing in the current app renders them yet. They belong with the
  feature pages that will use them; adding unused components now would be dead code.
- **View Transitions circular theme reveal (§6.9)** left as the existing
  crossfade — it's marked optional in the spec and the current theme toggle is
  already smooth and reduced-motion safe.
