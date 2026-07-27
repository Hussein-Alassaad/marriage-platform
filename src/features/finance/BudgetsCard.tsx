import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';

import { Button } from '@/components/Button';
import { Card, CardTitle } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useDeleteBudget, useBudgets, useSaveBudget, useUpdateBudget } from '@/hooks/useFinance';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings } from '@/hooks/useSettings';
import { monthKey } from '@/utils/date';
import { convert, formatMoney, type RateMap } from '@/utils/money';
import type { Budget, Entry } from '@/services/financeService';

/** Monthly budget per category, with this month's actual spending measured against it. */
export function BudgetsCard({
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
  const { list } = useSettings();
  const { data: budgets } = useBudgets(true);
  const save = useSaveBudget();
  const update = useUpdateBudget();
  const remove = useDeleteBudget();

  const categories = list('finance_expense_categories', ['other']);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState(categories[0] ?? 'other');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = editingId ? update.isPending : save.isPending;

  const month = monthKey();
  const spentIn = (cat: string, into: string) =>
    entries
      .filter((e) => e.kind === 'expense' && e.label === cat && e.occurred_on.startsWith(month))
      .reduce((sum, e) => sum + (convert(e.amount, e.currency, into, rates) ?? 0), 0);

  const startAdd = () => {
    setEditingId(null);
    setCategory(categories[0] ?? 'other');
    setAmount('');
    setError(null);
    setAdding((v) => !v);
  };

  const startEdit = (b: Budget) => {
    setEditingId(b.id);
    setCategory(b.category);
    setAmount(String(b.amount));
    setError(null);
    setAdding(true);
  };

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('finance.budgets.amountError'));
      return;
    }
    setError(null);
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, amount: value, currency });
      } else {
        await save.mutateAsync({ category, amount: value, currency });
      }
      setAmount('');
      setAdding(false);
      setEditingId(null);
    } catch {
      setError(t('finance.budgets.saveError'));
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>{t('finance.budgets.title')}</CardTitle>
        <Button size="sm" variant="ghost" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('finance.budgets.add')}
        </Button>
      </div>

      {adding ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {/* flex-wrap, not a fixed grid — see GoalsCard.tsx for why: a rigid grid
              with a fixed-width sibling can crush this field unusably narrow once
              the card is squeezed to half the page width. */}
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={Boolean(editingId)}
            className="min-w-40 flex-1"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`finance.category.${c}`, { defaultValue: c })}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${currency} 0.00`}
            className="w-40"
          />
          <Button onClick={submit} disabled={pending}>
            {t('finance.budgets.save')}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-danger mb-3 -mt-2 text-xs">{error}</p> : null}

      {!budgets?.length ? (
        <p className="text-muted py-6 text-center text-sm">{t('finance.budgets.empty')}</p>
      ) : (
        <ul className="space-y-4">
          {budgets.map((b) => {
            const limit = convert(b.amount, b.currency, currency, rates) ?? b.amount;
            const spent = spentIn(b.category, currency);
            const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
            const over = spent > limit;
            return (
              <li key={b.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Target className="text-brand-600 h-3.5 w-3.5" aria-hidden />
                  <span className="text-ink flex-1 text-sm font-medium">
                    {t(`finance.category.${b.category}`, { defaultValue: b.category })}
                  </span>
                  <span className={over ? 'text-danger text-xs font-medium' : 'text-muted text-xs'}>
                    {formatMoney(spent, currency, language)} /{' '}
                    {formatMoney(limit, currency, language)}
                  </span>
                  <button
                    type="button"
                    aria-label={t('finance.budgets.edit')}
                    onClick={() => startEdit(b)}
                    className="text-faint hover:bg-bg-3 hover:text-ink rounded-md p-1 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t('finance.budgets.delete')}
                    onClick={() => remove.mutate(b.id)}
                    className="text-faint hover:bg-danger-wash hover:text-danger rounded-md p-1 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <div className="bg-bg-3 h-1.5 overflow-hidden rounded-full">
                  <div
                    className={
                      over ? 'bg-danger h-full rounded-full' : 'bg-brand-500 h-full rounded-full'
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
