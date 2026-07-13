import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Repeat, Trash2, Wallet } from 'lucide-react';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { useDeleteEntry } from '@/hooks/useFinance';
import { useLanguage } from '@/hooks/useLanguage';
import { formatMoney } from '@/utils/money';
import type { Entry } from '@/services/financeService';

/** The plain history every member gets, free tier included (Decision #17). */
export function EntryList({ entries }: { entries: Entry[] }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const remove = useDeleteEntry();

  if (!entries.length) {
    return (
      <EmptyState
        icon={Wallet}
        title={t('finance.empty.title')}
        description={t('finance.empty.body')}
      />
    );
  }

  return (
    <Card className="divide-line divide-y">
      {entries.map((entry) => {
        const income = entry.kind === 'income';
        const Icon = income ? ArrowUpRight : ArrowDownLeft;
        return (
          <div key={`${entry.kind}-${entry.id}`} className="flex items-center gap-3 p-4">
            <span className={cnIcon(income)} aria-hidden>
              <Icon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-ink truncate text-sm font-medium">
                {t(`finance.${income ? 'source' : 'category'}.${entry.label}`, {
                  defaultValue: entry.label,
                })}
              </p>
              <p className="text-muted mt-0.5 flex items-center gap-1.5 text-xs">
                {new Date(entry.occurred_on).toLocaleDateString(language)}
                {entry.recurring ? (
                  <>
                    <Repeat className="h-3 w-3" aria-hidden />
                    {t('finance.entry.recurringShort')}
                  </>
                ) : null}
              </p>
            </div>

            <p
              className={
                income ? 'text-success text-sm font-semibold' : 'text-ink text-sm font-semibold'
              }
            >
              {income ? '+' : '−'}
              {formatMoney(entry.amount, entry.currency, language)}
            </p>

            <button
              type="button"
              aria-label={t('finance.entry.delete')}
              disabled={remove.isPending}
              onClick={() => remove.mutate({ kind: entry.kind, id: entry.id })}
              className="text-faint hover:bg-danger-wash hover:text-danger rounded-md p-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </Card>
  );
}

function cnIcon(income: boolean): string {
  return income
    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-wash text-success'
    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-3 text-muted';
}
