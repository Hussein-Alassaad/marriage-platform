import { type Transition, type Variants } from 'framer-motion';

/**
 * MITHAQ motion tokens — the single source of truth for easing, springs,
 * durations and entrance variants. Every animated primitive imports from here
 * so the whole app moves like one deliberate, tranquil system (Sakinah):
 * nothing bounces playfully, everything animates transform/opacity only.
 */

/* ── Easing (§2.6) ───────────────────────────────────────────────────────── */
/** Default premium curve. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Hero entrances, progress fills — a touch more dramatic. */
export const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Loops (aurora, conic rings). */
export const EASE_INOUT: [number, number, number, number] = [0.65, 0, 0.35, 1];
/** @deprecated alias kept for existing imports — use EASE_EXPO. */
export const EASE_OUT_EXPO = EASE_EXPO;

/* ── Springs (§2.6) ──────────────────────────────────────────────────────── */
/** Composed motion — cards, tilt. */
export const SPRING_GENTLE: Transition = { type: 'spring', stiffness: 260, damping: 30 };
/** Indicators, tabs, magnetic snap. */
export const SPRING_SNAPPY: Transition = { type: 'spring', stiffness: 380, damping: 30 };
/** Drawers, sheets. */
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 120, damping: 22, mass: 1.1 };
/** @deprecated alias kept for existing imports. */
export const springMicro: Transition = SPRING_SNAPPY;
/** @deprecated alias kept for existing imports (nav indicator). */
export const springLayout: Transition = SPRING_SNAPPY;

/* ── Durations (seconds) ─────────────────────────────────────────────────── */
export const durations = {
  instant: 0.1,
  fast: 0.18,
  base: 0.24,
  gentle: 0.4,
  slow: 0.6,
  cinematic: 0.9,
  /* legacy aliases */
  hover: 0.18,
  reveal: 0.55,
  page: 0.24,
  hero: 0.6,
  sheen: 0.6,
} as const;

/* ── Stagger (§2.6) — cap 12 children, then instant ──────────────────────── */
export const STAGGER_STEP = 0.07;
export const STAGGER_HERO = 0.09;
export const STAGGER_CAP = 12;

/* ── Entrance variants ───────────────────────────────────────────────────── */
/** Default entrance: opacity + 24px rise, ease-out-expo. */
export const entranceVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_EXPO } },
};

/** Card entrance: opacity + rise + gentle scale. */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_EXPO } },
};

/** @deprecated legacy name — reveal = opacity + 20px rise. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: durations.reveal, ease: EASE_EXPO } },
};

/** Stagger container. */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_STEP, delayChildren: 0.1 } },
};

/** Standard in-view trigger: fire once, a touch before the element is centered. */
export const inViewOnce = { once: true, margin: '-80px' } as const;

/**
 * Direction-aware x-offset. Every x-axis animation runs through this so slides
 * invert correctly under RTL (Arabic). Reads the live document direction.
 */
export const dx = (x: number): number =>
  typeof document !== 'undefined' && document.dir === 'rtl' ? -x : x;
