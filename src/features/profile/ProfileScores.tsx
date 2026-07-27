import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

import { Card, CardTitle } from '@/components/Card';
import { ProgressRing } from '@/components/motion/ProgressRing';
import { CountUp } from '@/components/motion/CountUp';
import { requireSupabaseClient } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import {
  computeMarriageReadiness,
  computeProfileQuality,
  computeTrustScore,
  profileQualitySuggestions,
  profileService,
  type ProfileRecord,
} from '@/services/profileService';

/**
 * Profile Quality Score + Marriage Readiness Score + Trust Score (PRD Part 5). All
 * deterministic (see profileService.ts) — no AI key required, same transparency
 * tradeoff as the compatibility engine and finance reports.
 *
 * The Marriage Readiness Score disclaimer is a PRD requirement, not a style choice:
 * "It must never be presented as an objective measure of someone's worth or
 * suitability for marriage."
 */
export function ProfileScores({ profile }: { profile: ProfileRecord | null }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const userId = user?.id;
  const primaryPath = (profile?.privacy?.primaryPhoto as string | undefined) ?? undefined;

  // Same query key PhotoManager uses — shares its cache, does not double-fetch.
  const { data: photos } = useQuery({
    queryKey: ['profile-photos', userId, primaryPath],
    enabled: Boolean(userId),
    queryFn: () => profileService.listPhotos(userId as string, primaryPath),
  });
  const photoCount = photos?.length ?? 0;

  // RLS: violations_read_own already lets a member read their own rows.
  const { data: violationCount } = useQuery({
    queryKey: ['violation-count', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const supabase = requireSupabaseClient();
      const { count } = await supabase
        .from('violations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId as string);
      return count ?? 0;
    },
  });

  if (!profile) return null;

  const readiness = computeMarriageReadiness(profile);
  const quality = computeProfileQuality(profile, photoCount);
  const trust = computeTrustScore(profile, violationCount ?? 0);
  const suggestions = profileQualitySuggestions(profile, photoCount);

  return (
    <Card className="p-6">
      <CardTitle>{t('profile.scores.title')}</CardTitle>

      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        <div className="flex items-center gap-4">
          <ProgressRing value={quality} size={72} stroke={5}>
            <span className="text-ink text-sm font-semibold">
              <CountUp value={quality} suffix="%" />
            </span>
          </ProgressRing>
          <div>
            <p className="text-ink text-sm font-medium">{t('profile.scores.qualityTitle')}</p>
            <p className="text-faint text-xs">{t('profile.scores.qualityHint')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ProgressRing value={readiness} size={72} stroke={5}>
            <span className="text-ink text-sm font-semibold">
              <CountUp value={readiness} suffix="%" />
            </span>
          </ProgressRing>
          <div>
            <p className="text-ink text-sm font-medium">{t('profile.scores.readinessTitle')}</p>
            <p className="text-faint text-xs">{t('profile.scores.readinessHint')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ProgressRing value={trust} size={72} stroke={5}>
            <span className="text-ink text-sm font-semibold">
              <CountUp value={trust} suffix="%" />
            </span>
          </ProgressRing>
          <div>
            <p className="text-ink text-sm font-medium">{t('profile.scores.trustTitle')}</p>
            <p className="text-faint text-xs">{t('profile.scores.trustHint')}</p>
          </div>
        </div>
      </div>

      <p className="text-faint mt-4 flex items-start gap-1.5 text-xs leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('profile.scores.disclaimer')}
      </p>

      {suggestions.length ? (
        <ul className="border-line mt-4 space-y-1.5 border-t pt-4">
          {suggestions.map((s) => (
            <li key={s} className="text-ink-soft text-sm">
              {t(`profile.scores.suggestion.${s}`)}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
