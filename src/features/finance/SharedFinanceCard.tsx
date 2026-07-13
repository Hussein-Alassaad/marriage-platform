import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, Link2Off, ShieldCheck } from 'lucide-react';

import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardDescription, CardTitle } from '@/components/Card';
import { useLanguage } from '@/hooks/useLanguage';
import {
  useSharedConsent,
  useSharedDisconnect,
  useSharedStatus,
  useSharedSummary,
} from '@/hooks/useFinance';
import { formatMoney, sumIn, type RateMap } from '@/utils/money';
import type { Totals } from '@/services/financeService';

/**
 * Couple Finance. Shown only for a married connection.
 *
 * Three things this card must never do, and does not:
 *  • activate on one person's consent (the server refuses; this only reflects it),
 *  • show the other spouse's individual entries — what is shared is monthly TOTALS,
 *  • make leaving harder than joining. Disconnect is one click, no counter-signature.
 */
export function SharedFinanceCard({
  matchId,
  currency,
  rates,
}: {
  matchId: string;
  currency: string;
  rates: RateMap;
}) {
  const { t } = useTranslation();
  const { data: status } = useSharedStatus(matchId);
  const consent = useSharedConsent(matchId);
  const disconnect = useSharedDisconnect(matchId);
  const { data: summary } = useSharedSummary(matchId, Boolean(status?.active));
  const [error, setError] = useState<string | null>(null);

  if (!status?.married) return null;

  const partner = status.partnerName ?? t('finance.shared.partnerFallback');

  const act = async (run: () => Promise<unknown>) => {
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('finance.shared.error'));
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-2">
        <HeartHandshake className="text-brand-600 h-4 w-4" aria-hidden />
        <CardTitle>{t('finance.shared.title')}</CardTitle>
        {status.active ? <Badge variant="success">{t('finance.shared.active')}</Badge> : null}
      </div>

      <CardDescription>{t('finance.shared.body', { name: partner })}</CardDescription>

      {status.active ? (
        <>
          <SharedTotals summary={summary} currency={currency} rates={rates} partner={partner} />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={disconnect.isPending}
              onClick={() => act(() => disconnect.mutateAsync())}
            >
              <Link2Off className="h-4 w-4" aria-hidden />
              {t('finance.shared.disconnect')}
            </Button>
            <p className="text-faint text-xs">{t('finance.shared.disconnectHint')}</p>
          </div>
        </>
      ) : !status.tiersOk ? (
        <p className="text-muted mt-4 text-sm">
          {t('finance.shared.tierRequired', {
            tier: t(`tier.${status.minTier}`, { defaultValue: status.minTier }),
          })}
        </p>
      ) : (
        <>
          <ul className="text-ink-soft my-5 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <ShieldCheck className="text-brand-500 mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('finance.shared.promiseTotals')}
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="text-brand-500 mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('finance.shared.promiseBoth')}
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="text-brand-500 mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('finance.shared.promiseLeave')}
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={status.myConsent || consent.isPending}
              onClick={() => act(() => consent.mutateAsync())}
            >
              {status.myConsent ? t('finance.shared.waiting') : t('finance.shared.consent')}
            </Button>
            {status.myConsent && !status.partnerConsent ? (
              <p className="text-muted text-xs">
                {t('finance.shared.waitingFor', { name: partner })}
              </p>
            ) : null}
            {!status.myConsent && status.partnerConsent ? (
              <p className="text-muted text-xs">
                {t('finance.shared.theyConsented', { name: partner })}
              </p>
            ) : null}
          </div>
        </>
      )}

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}

/** Monthly totals, side by side, in the reader's display currency. */
function SharedTotals({
  summary,
  currency,
  rates,
  partner,
}: {
  summary: { mine: Totals[]; theirs: Totals[] } | undefined;
  currency: string;
  rates: RateMap;
  partner: string;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (!summary) return null;

  const side = (totals: Totals[]) => {
    const income = sumIn(
      totals.map((x) => ({ amount: x.income, currency: x.currency })),
      currency,
      rates,
    );
    const expenses = sumIn(
      totals.map((x) => ({ amount: x.expenses, currency: x.currency })),
      currency,
      rates,
    );
    return { income: income.total, expenses: expenses.total, net: income.total - expenses.total };
  };

  const mine = side(summary.mine);
  const theirs = side(summary.theirs);
  const household = {
    income: mine.income + theirs.income,
    expenses: mine.expenses + theirs.expenses,
    net: mine.net + theirs.net,
  };

  const columns = [
    { key: 'you', label: t('finance.shared.you'), value: mine },
    { key: 'partner', label: partner, value: theirs },
    { key: 'household', label: t('finance.shared.household'), value: household },
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {columns.map((col) => (
        <div key={col.key} className="bg-bg-3 rounded-xl p-4">
          <p className="text-muted mb-2 truncate text-xs font-medium">{col.label}</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{t('finance.summary.income')}</dt>
              <dd className="text-success font-medium">
                {formatMoney(col.value.income, currency, language)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">{t('finance.summary.expenses')}</dt>
              <dd className="text-ink font-medium">
                {formatMoney(col.value.expenses, currency, language)}
              </dd>
            </div>
            <div className="border-line flex justify-between gap-2 border-t pt-1">
              <dt className="text-muted">{t('finance.summary.net')}</dt>
              <dd
                className={
                  col.value.net < 0 ? 'text-danger font-semibold' : 'text-success font-semibold'
                }
              >
                {formatMoney(col.value.net, currency, language)}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}
