import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, CreditCard, Heart, ShieldCheck, Users } from 'lucide-react';

import { Card, CardTitle } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { useAdminOverview, useHealth } from '@/hooks/useAdmin';

/**
 * The silent-failure traps, checked explicitly because none of them raise an error:
 * moderation switched on with no key (every message on the platform is being blocked right
 * now), a job that stopped running a week ago, exchange rates gone stale (which does not
 * fail — it quietly makes every figure on the finance page wrong), and queues nobody is
 * working. A dashboard that only shows what is fine is decoration.
 */
function HealthStrip() {
  const { t } = useTranslation();
  const { data } = useHealth();
  if (!data) return null;

  const problems = data.checks.filter((c) => !c.ok);
  if (!problems.length) {
    return (
      <p className="text-success flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {t('admin.health.allGood')}
      </p>
    );
  }

  return (
    <Card className="border-danger/30 p-4">
      <div className="text-danger mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="text-sm font-semibold">{t('admin.health.attention')}</span>
      </div>
      <ul className="space-y-1">
        {problems.map((c) => (
          <li key={c.key} className="text-ink-soft text-sm">
            <span className="font-medium">
              {t(`admin.health.${c.key}`, { defaultValue: c.key })}
            </span>
            {' — '}
            <span className="text-muted">
              {t(`admin.health.detail.${c.detail}`, { defaultValue: c.detail })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The health of the platform, with no way to reach into anyone's private life. There is
 * deliberately no "read a conversation" affordance here: moderation is judged from the
 * verdict log, not from people's messages.
 */
export function OverviewPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminOverview();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="rounded-card h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    { key: 'members', icon: Users, value: data.members },
    { key: 'verified', icon: ShieldCheck, value: data.verified },
    { key: 'activeMatches', icon: Heart, value: data.activeMatches },
    { key: 'pendingClaims', icon: CreditCard, value: data.pendingClaims },
  ] as const;

  const blockRate = data.moderation.checked
    ? Math.round((data.moderation.blocked / data.moderation.checked) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <HealthStrip />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.key} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <c.icon className="text-brand-600 h-4 w-4" aria-hidden />
              <p className="text-muted text-xs font-medium">{t(`admin.overview.${c.key}`)}</p>
            </div>
            <p className="font-display text-ink text-2xl font-semibold">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle className="mb-4">{t('admin.overview.tiers')}</CardTitle>
          <ul className="space-y-2">
            {Object.entries(data.tiers).map(([tier, n]) => (
              <li key={tier} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{t(`tier.${tier}`, { defaultValue: tier })}</span>
                <span className="text-ink font-medium">{n}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <CardTitle className="mb-1">{t('admin.overview.moderation')}</CardTitle>
          <p className="text-muted mb-4 text-xs">{t('admin.overview.moderationHint')}</p>
          <p className="text-ink mb-3 text-sm">
            {t('admin.overview.blockRate', {
              blocked: data.moderation.blocked,
              checked: data.moderation.checked,
              rate: blockRate,
            })}
          </p>
          <ul className="space-y-1.5">
            {Object.entries(data.moderation.byCategory).map(([category, n]) => (
              <li key={category} className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {t(`admin.category.${category}`, { defaultValue: category })}
                </span>
                <span className="text-ink font-medium">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
