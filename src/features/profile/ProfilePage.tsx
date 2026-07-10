import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Pencil, ShieldCheck } from 'lucide-react';

import { Card, CardTitle } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { ProgressRing } from '@/components/motion/ProgressRing';
import { CountUp } from '@/components/motion/CountUp';
import { PhotoManager } from '@/features/profile/PhotoManager';
import { useOptionLabel } from '@/features/profile/ProfileFields';
import { ROUTES } from '@/app/routes';
import { useProfile } from '@/hooks/useProfile';
import type { JsonMap } from '@/services/profileService';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink sm:text-end">{value ? value : '—'}</span>
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const label = useOptionLabel();
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const completion = profile?.profile_completion ?? 0;
  const initial = (profile?.display_name?.[0] ?? t('common.guestInitial')).toUpperCase();
  const verified = profile?.verification_status === 'verified';
  const languages = (profile?.languages ?? []).map((l) => label('language', l)).filter(Boolean).join('، ');
  const mg = (profile?.marriage_goals ?? {}) as JsonMap;
  const ls = (profile?.lifestyle ?? {}) as JsonMap;
  const fv = (profile?.family_values ?? {}) as JsonMap;
  const fr = (profile?.financial_readiness ?? {}) as JsonMap;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-start">
        <ProgressRing value={completion} size={112} stroke={5}>
          <span className="grid h-[86px] w-[86px] place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-2xl font-semibold text-brand-800">
            {initial}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-display text-2xl font-semibold text-ink">
              {profile?.display_name ?? t('common.guest')}
            </h1>
            {verified ? (
              <Badge variant="gold" withDot>
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                {t('profile.verified')}
              </Badge>
            ) : (
              <Link to={ROUTES.verifyIdentity} className="transition-opacity hover:opacity-80">
                <Badge variant="warning" withDot pulse>
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  {t(`verification.status.${profile?.verification_status ?? 'unverified'}`)}
                </Badge>
              </Link>
            )}
            <Badge variant="brand">{t(`tier.${profile?.subscription_tier ?? 'free'}`)}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            <CountUp value={completion} suffix="%" /> {t('profile.complete')}
          </p>
          <div className="mt-4 flex justify-center sm:justify-start">
            <Link to={ROUTES.onboarding}>
              <Button variant={completion < 100 ? 'gold' : 'secondary'}>
                {completion < 100 ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
                {completion < 100 ? t('profile.completeCta') : t('profile.editCta')}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* About */}
      {profile?.bio ? (
        <Card>
          <CardTitle>{t('profile.sections.about')}</CardTitle>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{profile.bio}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basics */}
        <Card>
          <CardTitle>{t('profile.sections.basics')}</CardTitle>
          <div className="mt-2">
            <Row label={t('profile.fields.gender')} value={profile?.gender ? t(`gender.${profile.gender}`) : null} />
            <Row label={t('profile.fields.nationality')} value={profile?.nationality} />
            <Row label={t('profile.fields.country')} value={profile?.country} />
            <Row label={t('profile.fields.city')} value={profile?.city} />
            <Row label={t('profile.fields.languages')} value={languages || null} />
          </div>
        </Card>

        {/* Background */}
        <Card>
          <CardTitle>{t('profile.sections.background')}</CardTitle>
          <div className="mt-2">
            <Row label={t('profile.fields.educationLevel')} value={label('education', profile?.education_level)} />
            <Row label={t('profile.fields.university')} value={profile?.university} />
            <Row label={t('profile.fields.major')} value={profile?.major} />
            <Row label={t('profile.fields.occupation')} value={profile?.occupation} />
            <Row label={t('profile.fields.employmentStatus')} value={label('employment', profile?.employment_status)} />
          </div>
        </Card>

        {/* Marriage goals */}
        <Card>
          <CardTitle>{t('profile.sections.goals')}</CardTitle>
          <div className="mt-2">
            <Row label={t('profile.fields.timeline')} value={label('timeline', mg.timeline)} />
            <Row label={t('profile.fields.children')} value={label('children', mg.children)} />
            <Row label={t('profile.fields.relocate')} value={label('relocate', mg.relocate)} />
          </div>
        </Card>

        {/* Values & lifestyle */}
        <Card>
          <CardTitle>{t('profile.sections.values')}</CardTitle>
          <div className="mt-2">
            <Row label={t('profile.fields.religiosity')} value={label('religiosity', ls.religiosity)} />
            <Row label={t('profile.fields.smoking')} value={label('smoking', ls.smoking)} />
            <Row label={t('profile.fields.familyInvolvement')} value={label('family', fv.involvement)} />
            <Row label={t('profile.fields.savings')} value={label('savings', fr.savings)} />
          </div>
        </Card>
      </div>

      {/* Photos */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>{t('profile.sections.photos')}</CardTitle>
          <Badge variant="neutral">{label('photoPrivacy', String(profile?.photo_privacy_mode ?? 2))}</Badge>
        </div>
        <div className="mt-4">
          <PhotoManager profile={profile ?? null} />
        </div>
      </Card>
    </div>
  );
}
