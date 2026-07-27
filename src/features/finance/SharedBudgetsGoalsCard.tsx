import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gem, Pencil, Plus, Target, Trash2 } from 'lucide-react';

import { Button } from '@/components/Button';
import { Card, CardDescription, CardTitle } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import {
  useContributeSharedGoal,
  useDeleteSharedBudget,
  useDeleteSharedGoal,
  useSaveSharedBudget,
  useSaveSharedGoal,
  useSharedBudgets,
  useSharedGoals,
  useSharedStatus,
} from '@/hooks/useFinance';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings } from '@/hooks/useSettings';
import { formatMoney } from '@/utils/money';
import type { SharedBudget, SharedGoal } from '@/services/financeService';

/**
 * Marriage Plus, on top of the shared monthly totals every Serious+ couple gets: a joint
 * budget (target vs. the SUM of both spouses' spending in a category — never either
 * person's entries) and a joint goal (one running balance either spouse can add to, like
 * a shared jar). Gated at `finance_shared_min_tier` — both spouses, checked server-side
 * on every call, same as the base Couple Finance gate.
 */
export function SharedBudgetsGoalsCard({ matchId, currency }: { matchId: string; currency: string }) {
  const { t } = useTranslation();
  const { data: status } = useSharedStatus(matchId);

  if (!status?.active) return null;

  if (!status.advancedUnlocked) {
    return (
      <Card className="p-6">
        <div className="mb-2 flex items-center gap-2">
          <Gem className="text-gold-500 h-4 w-4" aria-hidden />
          <CardTitle>{t('finance.sharedAdvanced.title')}</CardTitle>
        </div>
        <CardDescription>
          {t('finance.sharedAdvanced.upsell', {
            tier: t(`tier.${status.advancedMinTier}`, { defaultValue: status.advancedMinTier }),
          })}
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SharedBudgets matchId={matchId} currency={currency} />
      <SharedGoals matchId={matchId} currency={currency} />
    </div>
  );
}

function SharedBudgets({ matchId, currency }: { matchId: string; currency: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { list } = useSettings();
  const { data: budgets } = useSharedBudgets(matchId, true);
  const save = useSaveSharedBudget(matchId);
  const remove = useDeleteSharedBudget(matchId);

  const categories = list('finance_expense_categories', ['other']);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState(categories[0] ?? 'other');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startAdd = () => {
    setEditingId(null);
    setCategory(categories[0] ?? 'other');
    setAmount('');
    setError(null);
    setAdding((v) => !v);
  };

  const startEdit = (b: SharedBudget) => {
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
      // Server-side upsert on (match_id, category) — editing with the category
      // locked means this naturally updates the existing row rather than adding one.
      await save.mutateAsync({ category, amount: value, currency });
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
        <CardTitle>{t('finance.sharedAdvanced.budgetsTitle')}</CardTitle>
        <Button size="sm" variant="ghost" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('finance.budgets.add')}
        </Button>
      </div>

      {adding ? (
        <div className="mb-4 flex flex-wrap gap-2">
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
          <Button onClick={submit} disabled={save.isPending}>
            {t('finance.budgets.save')}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-danger mb-3 -mt-2 text-xs">{error}</p> : null}

      {!budgets?.length ? (
        <p className="text-muted py-6 text-center text-sm">{t('finance.sharedAdvanced.budgetsEmpty')}</p>
      ) : (
        <ul className="space-y-4">
          {budgets.map((b) => {
            const pct = b.amount > 0 ? Math.min(Math.round((b.spent / b.amount) * 100), 100) : 0;
            return (
              <li key={b.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Target className="text-brand-600 h-3.5 w-3.5" aria-hidden />
                  <span className="text-ink flex-1 text-sm font-medium">
                    {t(`finance.category.${b.category}`, { defaultValue: b.category })}
                  </span>
                  <span className={b.overBudget ? 'text-danger text-xs font-medium' : 'text-muted text-xs'}>
                    {formatMoney(b.spent, b.currency, language)} / {formatMoney(b.amount, b.currency, language)}
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
                    className={b.overBudget ? 'bg-danger h-full rounded-full' : 'bg-brand-500 h-full rounded-full'}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {b.unconvertible > 0 ? (
                  <p className="text-faint mt-1 text-xs">
                    {t('finance.summary.unconvertible', { count: b.unconvertible })}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SharedGoals({ matchId, currency }: { matchId: string; currency: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: goals } = useSharedGoals(matchId, true);
  const save = useSaveSharedGoal(matchId);
  const contribute = useContributeSharedGoal(matchId);
  const remove = useDeleteSharedGoal(matchId);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const startAdd = () => {
    setEditingId(null);
    setName('');
    setTarget('');
    setDeadline('');
    setError(null);
    setAdding((v) => !v);
  };

  const startEdit = (g: SharedGoal) => {
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
      await save.mutateAsync({
        id: editingId ?? undefined,
        name: name.trim(),
        target: value,
        currency,
        deadline: deadline || null,
      });
      setName('');
      setTarget('');
      setDeadline('');
      setAdding(false);
      setEditingId(null);
    } catch {
      setError(t('finance.goals.saveError'));
    }
  };

  const addContribution = (id: string, currentAmount: number) => {
    const raw = Number(contributions[id]);
    if (!Number.isFinite(raw) || raw <= 0) return;
    contribute.mutate({ id, newAmount: currentAmount + raw });
    setContributions((c) => ({ ...c, [id]: '' }));
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>{t('finance.sharedAdvanced.goalsTitle')}</CardTitle>
        <Button size="sm" variant="ghost" onClick={startAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('finance.goals.add')}
        </Button>
      </div>

      {adding ? (
        <div className="mb-4 flex flex-wrap gap-2">
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
          <Button onClick={submit} disabled={save.isPending}>
            {t('finance.goals.save')}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-danger mb-3 -mt-2 text-xs">{error}</p> : null}

      {!goals?.length ? (
        <p className="text-muted py-6 text-center text-sm">{t('finance.sharedAdvanced.goalsEmpty')}</p>
      ) : (
        <ul className="space-y-5">
          {goals.map((g) => {
            const pct =
              g.target_amount > 0 ? Math.min(Math.round((g.current_amount / g.target_amount) * 100), 100) : 0;
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
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contributions[g.id] ?? ''}
                    onChange={(e) => setContributions((c) => ({ ...c, [g.id]: e.target.value }))}
                    placeholder={`${g.currency} 0.00`}
                    className="h-9 w-32 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={contribute.isPending}
                    onClick={() => addContribution(g.id, g.current_amount)}
                  >
                    {t('finance.goals.contribute')}
                  </Button>
                  {g.deadline ? (
                    <span className="text-faint text-xs">
                      {t('finance.goals.by', { date: new Date(g.deadline).toLocaleDateString(language) })}
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
