import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { Card, CardTitle } from '@/components/Card';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/utils/cn';
import type { ProfileRecord } from '@/services/profileService';

// A snappy spring reads as bouncy/jittery at this scale (a 20px thumb sliding
// 22px) — the track's flip and the thumb's slide need to land together and
// stay still, not overshoot. A short, no-bounce tween instead.
const TOGGLE_MOTION = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

interface PrivacyPrefs {
  onlineStatus?: boolean;
  activityStatus?: boolean;
  readReceipts?: boolean;
  primaryPhoto?: string | null;
  [key: string]: unknown;
}

const TOGGLES = ['onlineStatus', 'activityStatus', 'readReceipts'] as const;

/**
 * Privacy Controls (PRD Part 5): Online Status, Read Receipts, Activity Status.
 * All default ON (true) — a member opts OUT, not in, matching how these three
 * behave on most messaging platforms. Stored in the existing `privacy` jsonb
 * column alongside `primaryPhoto`; nothing new to grant.
 */
export function PrivacyToggles({ profile }: { profile: ProfileRecord | null }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const isRtl = useDirection() === 'rtl';
  const privacy = (profile?.privacy ?? {}) as PrivacyPrefs;

  const toggle = (key: (typeof TOGGLES)[number]) => {
    if (!profile) return;
    const current = privacy[key] !== false; // default true
    update.mutate({
      patch: { privacy: { ...privacy, [key]: !current } },
      current: profile,
    });
  };

  if (!profile) return null;

  return (
    <Card className="p-6">
      <CardTitle>{t('profile.privacy.title')}</CardTitle>
      <p className="text-muted mt-1 text-sm">{t('profile.privacy.body')}</p>

      <ul className="mt-4 space-y-3">
        {TOGGLES.map((key) => {
          const on = privacy[key] !== false;
          return (
            <li key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-ink text-sm font-medium">{t(`profile.privacy.${key}`)}</p>
                <p className="text-faint text-xs">{t(`profile.privacy.${key}Hint`)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t(`profile.privacy.${key}`)}
                onClick={() => toggle(key)}
                disabled={update.isPending}
                className={cn(
                  // Flat and solid, not a gradient/glow — at 44px wide a diagonal
                  // gradient reads as busy rather than premium. A single inset
                  // shadow on the track (depth) plus a crisp thumb shadow is the
                  // same language Stripe/Linear-style dashboards use for switches.
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-[180ms] active:scale-95',
                  '[box-shadow:inset_0_1px_2px_rgba(10,31,23,0.18)]',
                  'focus-visible:outline-none focus-visible:[box-shadow:inset_0_1px_2px_rgba(10,31,23,0.18),0_0_0_2px_var(--color-bg-0),0_0_0_4px_var(--color-brand-400)]',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'bg-brand-500' : 'bg-bg-4 hover:bg-bg-3',
                )}
              >
                <motion.span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white [box-shadow:0_1px_3px_rgba(10,31,23,0.35),0_1px_2px_rgba(10,31,23,0.15)]"
                  animate={{ x: on ? (isRtl ? -22 : 22) : 2 }}
                  transition={TOGGLE_MOTION}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
