import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/Button';
import { Card, CardTitle } from '@/components/Card';
import { Input } from '@/components/Input';
import {
  useContributeToGoal,
  useDeleteGoal,
  useGoals,
  useSaveGoal,
  useUpdateGoal,
} from '@/hooks/useFinance';
import { useLanguage } from '@/hooks/useLanguage';
import { formatMoney } from '@/utils/money';
import type { Goal } from '@/services/financeService';

/**
 * Savings goals, including the wedding goal — a goal holds a BALANCE, so a contribution
 * updates it rather than adding a ledger entry (money already spent is not saved money).
 */
export function GoalsCard({ currency }: { currency: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: goals } = useGoals(true);
  const save = useSaveGoal();
  const update = useUpdateGoal();
  const contribute = useContributeToGoal();
  const remove = useDeleteGoal();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = editingId ? update.isPending : save.isPending;

  const startAdd = () => {
    setEditingId(null);
    setName('');
    setTarget('');
    setDeadline('');
    setError(null);
    setAdding((v) => !v);
  };

  const startEdit = (g: Goal) => {
    setEditingId(g.id);
    setName(g.name);
    setTarget(String(g.target_amount));
    setDeadline(g.deadline ?? '');
    setError(null);
    setAdding(true);
  };

  const submit = async () => {
    const value = Number(target);
    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      setError(t('finance.goals.nameError'));
      return;
    }
    setError(null);
    try {
      if (editingId) {
        await update.mutateAsync({
          id: editingId,
          name: name.trim(),
          target: value,
          currency,
          deadline: deadline || null,
        });
      } else {
        await save.mutateAsync({
          name: name.trim(),
          target: value,
          currency,
          deadline: deadline || null,
        });
      }
      setName('');
      setTarget('');
      setDeadline('');
      setAdding(false);
      setEditingId(null);
    } catch {
      setError(t('finance.goals.saveError'));
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>{t('finance.goals.title')}</CardTitle>
        <Button size="sm" variant="ghost" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('finance.goals.add')}
        </Button>
      </div>

      {adding ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {/* flex-wrap, not a fixed grid: this card can end up squeezed to half the
              page width (FinancePage's lg:grid-cols-2) minus the sidebar, and a rigid
              grid with fixed-width siblings crushed this field down to a sliver you
              couldn't see text in. Now it just drops to its own line instead. */}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('finance.goals.namePlaceholder')}
            className="min-w-44 flex-1"
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={`${currency} 0.00`}
            className="w-36"
          />
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-44"
          />
          <Button onClick={submit} disabled={pending}>
            {t('finance.goals.save')}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-danger mb-3 -mt-2 text-xs">{error}</p> : null}

      {!goals?.length ? (
        <p className="text-muted py-6 text-center text-sm">{t('finance.goals.empty')}</p>
      ) : (
        <ul className="space-y-5">
          {goals.map((g) => {
            const pct =
              g.target_amount > 0
                ? Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100)
                : 0;
            return (
              <li key={g.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-ink flex-1 truncate text-sm font-medium">{g.name}</span>
                  <span className="text-muted text-xs">
                    {formatMoney(g.current_amount, g.currency, language)} /{' '}
                    {formatMoney(g.target_amount, g.currency, language)}
                  </span>
                  <button
                    type="button"
                    aria-label={t('finance.goals.edit')}
                    onClick={() => startEdit(g)}
                    className="text-faint hover:bg-bg-3 hover:text-ink rounded-md p-1 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t('finance.goals.delete')}
                    onClick={() => remove.mutate(g.id)}
                    className="text-faint hover:bg-danger-wash hover:text-danger rounded-md p-1 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                <div className="bg-bg-3 mb-2 h-1.5 overflow-hidden rounded-full">
                  <div className="bg-brand-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center gap-2">
                  <ContributeInput
                    currency={g.currency}
                    pending={contribute.isPending}
                    onAdd={(value) =>
                      contribute.mutate({ id: g.id, newAmount: Number(g.current_amount) + value })
                    }
                  />
                  {g.deadline ? (
                    <span className="text-faint text-xs">
                      {t('finance.goals.by', {
                        date: new Date(g.deadline).toLocaleDateString(language),
                      })}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ContributeInput({
  currency,
  pending,
  onAdd,
}: {
  currency: string;
  pending: boolean;
  onAdd: (value: number) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const add = () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onAdd(amount);
    setValue('');
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`${currency} 0.00`}
        className="h-9 w-32 text-sm"
      />
      <Button size="sm" variant="outline" onClick={add} disabled={pending}>
        {t('finance.goals.contribute')}
      </Button>
    </div>
  );
}
