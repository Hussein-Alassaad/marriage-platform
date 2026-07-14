import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card, CardTitle } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/utils/cn';
import { useAnalytics } from '@/hooks/useAdmin';
import { downloadCsv } from '@/utils/csv';

const RANGES = [7, 30, 90] as const;

/** The order a member actually moves through. A funnel out of order tells you nothing. */
const STAGES = [
  'interest_sent',
  'introduction',
  'serious_communication',
  'family',
  'married',
  'terminated',
];

/**
 * Aggregates only. Note what is not here and cannot be added without someone noticing: no
 * message content, and no personal finance. Admins get shapes and counts — "how many people
 * are stuck at Introduction" — never a person's words or a person's spending.
 *
 * The two numbers that decide whether this platform works at all are the conversion rates:
 * if people sign up and never verify, nothing downstream matters.
 */
export function AnalyticsPanel() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useAnalytics(days, true);

  if (isLoading || !data) {
    return <Skeleton className="rounded-card h-96" />;
  }

  const maxFunnel = Math.max(1, ...Object.values(data.funnel));
  const signups = Object.entries(data.signupsByDay).sort(([a], [b]) => a.localeCompare(b));
  const maxSignups = Math.max(1, ...signups.map(([, n]) => n));
  const blockRate = data.moderation.checked
    ? Math.round((data.moderation.blocked / data.moderation.checked) * 100)
    : 0;

  const exportCsv = () => {
    const rows: string[][] = [
      ['metric', 'value'],
      ['range_days', String(data.days)],
      ['members', String(data.conversion.total)],
      ['verified', String(data.conversion.verified)],
      ['verified_rate_pct', String(data.conversion.verifiedRate)],
      ['paid', String(data.conversion.paid)],
      ['paid_rate_pct', String(data.conversion.paidRate)],
      ['messages_checked', String(data.moderation.checked)],
      ['messages_blocked', String(data.moderation.blocked)],
      ...STAGES.map((s) => [`stage_${s}`, String(data.funnel[s] ?? 0)]),
      ...Object.entries(data.revenue).map(([c, v]) => [`revenue_${c}`, String(v)]),
      ...signups.map(([day, n]) => [`signups_${day}`, String(n)]),
    ];
    downloadCsv(`mithaq-analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setDays(r)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              days === r
                ? 'bg-brand-wash text-brand-700 ring-1 ring-[color:var(--color-border-accent)] ring-inset'
                : 'text-muted hover:bg-bg-3 hover:text-ink',
            )}
          >
            {t('admin.analytics.days', { count: r })}
          </button>
        ))}
        <Button size="sm" variant="outline" className="ms-auto" onClick={exportCsv}>
          {t('admin.analytics.export')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('admin.analytics.members')} value={String(data.conversion.total)} />
        <Stat
          label={t('admin.analytics.verifiedRate')}
          value={`${data.conversion.verifiedRate}%`}
          hint={t('admin.analytics.verifiedHint')}
        />
        <Stat
          label={t('admin.analytics.paidRate')}
          value={`${data.conversion.paidRate}%`}
          hint={t('admin.analytics.paidHint')}
        />
        <Stat label={t('admin.analytics.blockRate')} value={`${blockRate}%`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle className="mb-1">{t('admin.analytics.funnel')}</CardTitle>
          <p className="text-muted mb-4 text-xs">{t('admin.analytics.funnelHint')}</p>
          <ul className="space-y-2.5">
            {STAGES.map((stage) => {
              const n = data.funnel[stage] ?? 0;
              return (
                <li key={stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-soft">
                      {t(`journey.stage.${stage}`, { defaultValue: stage })}
                    </span>
                    <span className="text-ink font-medium">{n}</span>
                  </div>
                  <div className="bg-bg-3 h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        stage === 'terminated' ? 'bg-danger' : 'bg-brand-500',
                      )}
                      style={{ width: `${(n / maxFunnel) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <CardTitle className="mb-4">{t('admin.analytics.signups')}</CardTitle>
          {signups.length ? (
            <div className="flex h-40 items-end gap-1">
              {signups.map(([day, n]) => (
                <div
                  key={day}
                  title={`${day}: ${n}`}
                  className="bg-brand-500/70 hover:bg-brand-500 min-h-[2px] flex-1 rounded-t transition-colors"
                  style={{ height: `${(n / maxSignups) * 100}%` }}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted py-12 text-center text-sm">{t('admin.analytics.noSignups')}</p>
          )}
        </Card>

        <Card className="p-5">
          <CardTitle className="mb-4">{t('admin.analytics.revenue')}</CardTitle>
          {Object.keys(data.revenue).length ? (
            <ul className="space-y-2">
              {Object.entries(data.revenue).map(([currency, total]) => (
                <li key={currency} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{currency}</span>
                  <span className="text-ink font-semibold">{total.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted py-6 text-center text-sm">{t('admin.analytics.noRevenue')}</p>
          )}
        </Card>

        <Card className="p-5">
          <CardTitle className="mb-4">{t('admin.analytics.ai')}</CardTitle>
          {Object.keys(data.ai).length ? (
            <ul className="space-y-2">
              {Object.entries(data.ai).map(([feature, stats]) => (
                <li key={feature} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{feature}</span>
                  <span className={stats.errors ? 'text-danger' : 'text-ink'}>
                    {t('admin.analytics.aiStats', {
                      calls: stats.calls,
                      errors: stats.errors,
                      tokens: stats.tokens.toLocaleString(),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted py-6 text-center text-sm">{t('admin.analytics.noAi')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-muted mb-2 text-xs font-medium">{label}</p>
      <p className="font-display text-ink text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-faint mt-1 text-xs">{hint}</p> : null}
    </Card>
  );
}
