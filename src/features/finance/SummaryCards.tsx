import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { Card } from '@/components/Card';
import { EASE_OUT } from '@/lib/motion';
import { useLanguage } from '@/hooks/useLanguage';
import { formatMoney, sumIn, type RateMap } from '@/utils/money';
import type { Entry } from '@/services/financeService';

/**
 * This month's statistics — a Serious-tier feature (Decision #17), so it is only
 * rendered behind the tier gate in FinancePage.
 */
export function SummaryCards({
  entries,
  currency,
  rates,
}: {
  entries: Entry[];
  currency: string;
  rates: RateMap;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = entries.filter((e) => e.occurred_on.startsWith(month));

  const income = sumIn(
    thisMonth.filter((e) => e.kind === 'income'),
    currency,
    rates,
  );
  const expenses = sumIn(
    thisMonth.filter((e) => e.kind === 'expense'),
    currency,
    rates,
  );
  const net = income.total - expenses.total;
  const savingsRate = income.total > 0 ? Math.round((net / income.total) * 100) : 0;
  const unconvertible = income.unconvertible + expenses.unconvertible;

  const cards = [
    {
      key: 'income',
      icon: TrendingUp,
      value: formatMoney(income.total, currency, language),
      tone: 'text-success',
    },
    {
      key: 'expenses',
      icon: TrendingDown,
      value: formatMoney(expenses.total, currency, language),
      tone: 'text-ink',
    },
    {
      key: 'net',
      icon: Wallet,
      value: formatMoney(net, currency, language),
      tone: net < 0 ? 'text-danger' : 'text-success',
    },
    { key: 'savingsRate', icon: PiggyBank, value: `${savingsRate}%`, tone: 'text-ink' },
  ] as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT, delay: i * 0.05 }}
          >
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <card.icon className="text-brand-600 h-4 w-4" aria-hidden />
                <p className="text-muted text-xs font-medium">{t(`finance.summary.${card.key}`)}</p>
              </div>
              <p className={`font-display text-xl font-semibold ${card.tone}`}>{card.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Never quietly drop an amount we cannot convert — say so. */}
      {unconvertible > 0 ? (
        <p className="text-warning mt-3 text-xs">
          {t('finance.summary.unconvertible', { count: unconvertible })}
        </p>
      ) : null}
    </>
  );
}
