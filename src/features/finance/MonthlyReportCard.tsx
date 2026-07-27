import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardDescription, CardTitle } from '@/components/Card';
import { Select } from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings } from '@/hooks/useSettings';
import { useReportNarrative, useReports } from '@/hooks/useFinance';
import { formatMoney } from '@/utils/money';

/**
 * A frozen snapshot, not a live view — the numbers are computed once by the
 * monthly_finance_reports cron job and never recalculated here, per Decision #14
 * (a report must read the same way in six months even after the LBP moves).
 */
export function MonthlyReportCard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { bool } = useSettings();
  const { data: reports, isLoading } = useReports(true);
  const narrative = useReportNarrative();
  const [periodIndex, setPeriodIndex] = useState(0);

  const report = reports?.[periodIndex];
  const insightsEnabled = bool('finance_ai_insights_enabled');
  const latestReportId = reports?.[0]?.id;

  // Reset to the latest report whenever the list changes underneath us.
  useEffect(() => {
    setPeriodIndex(0);
  }, [latestReportId]);

  if (isLoading) {
    return <Skeleton className="rounded-card h-64" />;
  }

  if (!reports?.length) {
    return (
      <Card className="p-6">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="text-brand-600 h-4 w-4" aria-hidden />
          <CardTitle>{t('finance.report.title')}</CardTitle>
        </div>
        <CardDescription>{t('finance.report.empty')}</CardDescription>
      </Card>
    );
  }

  const d = report!.data;
  const net = d.income - d.expenses;
  const netDelta = net - d.previous.net;
  const monthLabel = new Date(`${report!.period}-01T00:00:00`).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="text-brand-600 h-4 w-4" aria-hidden />
          <CardTitle>{t('finance.report.title')}</CardTitle>
        </div>
        {reports.length > 1 ? (
          <Select
            aria-label={t('finance.report.period')}
            value={periodIndex}
            onChange={(e) => setPeriodIndex(Number(e.target.value))}
            className="h-9 w-auto"
          >
            {reports.map((r, i) => (
              <option key={r.id} value={i}>
                {new Date(`${r.period}-01T00:00:00`).toLocaleDateString(language, {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <CardDescription>{monthLabel}</CardDescription>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="bg-bg-3 rounded-xl p-4">
          <p className="text-muted mb-1 text-xs">{t('finance.summary.income')}</p>
          <p className="text-success text-lg font-semibold">
            {formatMoney(d.income, d.currency, language)}
          </p>
        </div>
        <div className="bg-bg-3 rounded-xl p-4">
          <p className="text-muted mb-1 text-xs">{t('finance.summary.expenses')}</p>
          <p className="text-ink text-lg font-semibold">
            {formatMoney(d.expenses, d.currency, language)}
          </p>
        </div>
        <div className="bg-bg-3 rounded-xl p-4">
          <p className="text-muted mb-1 flex items-center gap-1 text-xs">
            {t('finance.summary.net')}
            {netDelta !== 0 ? (
              netDelta > 0 ? (
                <TrendingUp className="text-success h-3.5 w-3.5" aria-hidden />
              ) : (
                <TrendingDown className="text-danger h-3.5 w-3.5" aria-hidden />
              )
            ) : null}
          </p>
          <p className={`text-lg font-semibold ${net < 0 ? 'text-danger' : 'text-success'}`}>
            {formatMoney(net, d.currency, language)}
          </p>
        </div>
      </div>

      {d.unconvertible > 0 ? (
        <p className="text-faint mt-3 text-xs">
          {t('finance.summary.unconvertible', { count: d.unconvertible })}
        </p>
      ) : null}

      {d.byCategory.length ? (
        <div className="mt-5">
          <h3 className="text-ink-soft mb-2 text-sm font-medium">
            {t('finance.charts.byCategory')}
          </h3>
          <ul className="space-y-1.5">
            {d.byCategory.slice(0, 6).map((c) => (
              <li key={c.category} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {t(`finance.category.${c.category}`, { defaultValue: c.category })}
                </span>
                <span className="text-ink font-medium">
                  {formatMoney(c.amount, d.currency, language)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.budgets.length ? (
        <div className="mt-5">
          <h3 className="text-ink-soft mb-2 text-sm font-medium">
            {t('finance.budgets.title')}
          </h3>
          <ul className="space-y-1.5">
            {d.budgets.map((b) => (
              <li key={b.category} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {t(`finance.category.${b.category}`, { defaultValue: b.category })}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-ink font-medium">
                    {formatMoney(b.spent, b.currency, language)} /{' '}
                    {formatMoney(b.budgeted, b.currency, language)}
                  </span>
                  {b.overBudget ? (
                    <Badge variant="danger">{t('finance.report.overBudget')}</Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.goals.length ? (
        <div className="mt-5">
          <h3 className="text-ink-soft mb-2 text-sm font-medium">{t('finance.goals.title')}</h3>
          <ul className="space-y-3">
            {d.goals.map((g) => (
              <li key={g.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{g.name}</span>
                  <span className="text-faint text-xs">{g.progressPct}%</span>
                </div>
                <div className="bg-bg-3 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-brand-500 h-full rounded-full"
                    style={{ width: `${g.progressPct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-line mt-5 border-t pt-4">
        {!insightsEnabled ? (
          <p className="text-faint flex items-center gap-2 text-xs">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('finance.insightsSoon')}
          </p>
        ) : d.narrative ? (
          <p className="text-ink-soft flex items-start gap-2 text-sm">
            <Sparkles className="text-brand-500 mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {d.narrative}
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={narrative.isPending}
            onClick={() => narrative.mutate({ reportId: report!.id, locale: language })}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {narrative.isPending ? t('finance.report.thinking') : t('finance.report.getInsight')}
          </Button>
        )}
      </div>
    </Card>
  );
}
