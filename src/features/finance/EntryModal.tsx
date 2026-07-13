import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { cn } from '@/utils/cn';
import { useSettings } from '@/hooks/useSettings';
import { useAddEntry } from '@/hooks/useFinance';
import type { EntryKind } from '@/services/financeService';

const INCOME_SOURCES = ['salary', 'business', 'freelance', 'investment', 'gift', 'other'];

/** Add income or an expense. The amount is stored in the currency chosen here (Decision #14). */
export function EntryModal({
  open,
  onClose,
  defaultCurrency,
}: {
  open: boolean;
  onClose: () => void;
  defaultCurrency: string;
}) {
  const { t } = useTranslation();
  const { list } = useSettings();
  const add = useAddEntry();

  const currencies = list('finance_currencies', ['USD']);
  const categories = list('finance_expense_categories', ['other']);

  const [kind, setKind] = useState<EntryKind>('expense');
  const [label, setLabel] = useState(categories[0] ?? 'other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = kind === 'income' ? INCOME_SOURCES : categories;

  const switchKind = (next: EntryKind) => {
    setKind(next);
    setLabel((next === 'income' ? INCOME_SOURCES : categories)[0] ?? 'other');
  };

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('finance.entry.amountError'));
      return;
    }
    setError(null);
    try {
      await add.mutateAsync({ kind, label, amount: value, currency, occurredOn, recurring });
      setAmount('');
      onClose();
    } catch {
      setError(t('finance.entry.saveError'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('finance.entry.title')}>
      <div className="bg-bg-3 mb-5 inline-flex w-full rounded-full p-1">
        {(['expense', 'income'] as EntryKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => switchKind(k)}
            className={cn(
              'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              kind === k ? 'bg-surface text-ink shadow-e1' : 'text-muted hover:text-ink',
            )}
          >
            {t(`finance.kind.${k}`)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-sm font-medium">
            {t(kind === 'income' ? 'finance.entry.source' : 'finance.entry.category')}
          </span>
          <Select value={label} onChange={(e) => setLabel(e.target.value)}>
            {labels.map((c) => (
              <option key={c} value={c}>
                {t(`finance.${kind === 'income' ? 'source' : 'category'}.${c}`, {
                  defaultValue: c,
                })}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-sm font-medium">
              {t('finance.entry.amount')}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="block">
            <span className="text-ink-soft mb-1.5 block text-sm font-medium">
              {t('finance.entry.currency')}
            </span>
            <Select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="sm:w-28"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="block">
          <span className="text-ink-soft mb-1.5 block text-sm font-medium">
            {t('finance.entry.date')}
          </span>
          <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </label>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="border-line text-brand-600 h-4 w-4 rounded focus-visible:outline-none"
          />
          <span className="text-ink-soft text-sm">{t('finance.entry.recurring')}</span>
        </label>

        {error ? <p className="text-danger text-xs">{error}</p> : null}

        <Button fullWidth onClick={submit} disabled={add.isPending}>
          {t('finance.entry.save')}
        </Button>
      </div>
    </Modal>
  );
}
