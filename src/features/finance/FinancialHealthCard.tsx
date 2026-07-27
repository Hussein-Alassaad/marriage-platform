import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';

import { Card, CardDescription, CardTitle } from '@/components/Card';
import { ProgressRing } from '@/components/motion/ProgressRing';
import { CountUp } from '@/components/motion/CountUp';
import { useBudgets, useGoals } from '@/hooks/useFinance';
import { computeFinancialHealth } from './financialHealth';
import type { Entry } from '@/services/financeService';
import type { RateMap } from '@/utils/money';

/**
 * Financial Health Score (PRD Part 8) — deterministic (see financialHealth.ts), no
 * AI key required. "The score is educational only. Never judge users. Always
 * explain improvements." (PRD) — the disclaimer below is that requirement, not
 * decoration.
 */
export function FinancialHealthCard({
  entries,
  currency,
  rates,
}: {
  entries: Entry[];
  currency: string;
  rates: RateMap;
}) {
  const { t } = useTranslation();
  const { data: budgets } = useBudgets(true);
  const { data: goals } = useGoals(true);

  const score = computeFinancialHealth(entries, budgets ?? [], goals ?? [], currency, rates);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <ProgressRing value={score} size={72} stroke={5}>
          <span className="text-ink text-sm font-semibold">
            <CountUp value={score} suffix="%" />
          </span>
        </ProgressRing>
        <div>
          <CardTitle>{t('finance.health.title')}</CardTitle>
          <CardDescription>{t('finance.health.hint')}</CardDescription>
        </div>
      </div>
      <p className="text-faint mt-4 flex items-start gap-1.5 text-xs leading-relaxed">
        <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('finance.health.disclaimer')}
      </p>
    </Card>
  );
}
