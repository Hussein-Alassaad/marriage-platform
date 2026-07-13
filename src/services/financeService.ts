import { requireSupabaseClient } from '@/lib/supabase';
import type { Rate } from '@/utils/money';

/**
 * Personal finance is the one domain where the client writes directly: every row is
 * owner-only under RLS (`user_id = auth.uid()`), nobody else can read it, and there is
 * deliberately NO admin policy on these tables — admins see aggregates, never a
 * member's spending. Shared (couple) finance is different: it crosses two users, so it
 * goes through the `finance` Edge Function.
 */

export type EntryKind = 'income' | 'expense';

export interface Entry {
  id: string;
  amount: number;
  currency: string;
  occurred_on: string;
  recurring: boolean;
  /** Income calls it a source, expenses call it a category — one label either way. */
  label: string;
  kind: EntryKind;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  currency: string;
  period: string;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  deadline: string | null;
}

export interface SharedFinance {
  id: string;
  match_id: string;
  active: boolean;
  /** Whether *this* caller has consented — the function resolves which side they are. */
  myConsent: boolean;
  partnerConsent: boolean;
}

interface IncomeRow {
  id: string;
  source: string | null;
  amount: number;
  currency: string;
  recurring: boolean;
  occurred_on: string;
}
interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  currency: string;
  recurring: boolean;
  occurred_on: string;
}

export const financeService = {
  /** The member's display currency. Created on first visit with the platform default. */
  async getPrimaryCurrency(userId: string, fallback: string): Promise<string> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('finance_accounts')
      .select('primary_currency')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.primary_currency ?? fallback;
  },

  async setPrimaryCurrency(userId: string, currency: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('finance_accounts')
      .upsert({ user_id: userId, primary_currency: currency }, { onConflict: 'user_id' });
    if (error) throw error;
  },

  /** Both ledgers, newest first, merged into one shape the UI can render as a list. */
  async listEntries(userId: string, since: string): Promise<Entry[]> {
    const supabase = requireSupabaseClient();
    const [incomeRes, expenseRes] = await Promise.all([
      supabase
        .from('income')
        .select('id, source, amount, currency, recurring, occurred_on')
        .eq('user_id', userId)
        .gte('occurred_on', since)
        .order('occurred_on', { ascending: false }),
      supabase
        .from('expenses')
        .select('id, category, amount, currency, recurring, occurred_on')
        .eq('user_id', userId)
        .gte('occurred_on', since)
        .order('occurred_on', { ascending: false }),
    ]);
    if (incomeRes.error) throw incomeRes.error;
    if (expenseRes.error) throw expenseRes.error;

    const income: Entry[] = ((incomeRes.data ?? []) as IncomeRow[]).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      occurred_on: r.occurred_on,
      recurring: r.recurring,
      label: r.source ?? 'other',
      kind: 'income',
    }));
    const expenses: Entry[] = ((expenseRes.data ?? []) as ExpenseRow[]).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      occurred_on: r.occurred_on,
      recurring: r.recurring,
      label: r.category,
      kind: 'expense',
    }));
    return [...income, ...expenses].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  },

  async addEntry(
    userId: string,
    input: {
      kind: EntryKind;
      label: string;
      amount: number;
      currency: string;
      occurredOn: string;
      recurring: boolean;
    },
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const common = {
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      occurred_on: input.occurredOn,
      recurring: input.recurring,
    };
    const { error } =
      input.kind === 'income'
        ? await supabase.from('income').insert({ ...common, source: input.label })
        : await supabase.from('expenses').insert({ ...common, category: input.label });
    if (error) throw error;
  },

  async deleteEntry(kind: EntryKind, id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from(kind === 'income' ? 'income' : 'expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** Latest rate per currency; the query orders by date so `toRateMap` keeps the newest. */
  async listRates(): Promise<Rate[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('base_currency, quote_currency, rate, as_of')
      .eq('base_currency', 'USD')
      .order('as_of', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Rate[];
  },

  async listBudgets(userId: string): Promise<Budget[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('budgets')
      .select('id, category, amount, currency, period')
      .eq('user_id', userId);
    if (error) throw error;
    return ((data ?? []) as Budget[]).map((b) => ({ ...b, amount: Number(b.amount) }));
  },

  async saveBudget(
    userId: string,
    input: { category: string; amount: number; currency: string },
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('budgets').insert({
      user_id: userId,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      period: 'monthly',
    });
    if (error) throw error;
  },

  async deleteBudget(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
  },

  async listGoals(userId: string): Promise<Goal[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('savings_goals')
      .select('id, name, target_amount, current_amount, currency, deadline')
      .eq('user_id', userId)
      .order('deadline', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return ((data ?? []) as Goal[]).map((g) => ({
      ...g,
      target_amount: Number(g.target_amount),
      current_amount: Number(g.current_amount),
    }));
  },

  async saveGoal(
    userId: string,
    input: { name: string; target: number; currency: string; deadline: string | null },
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('savings_goals').insert({
      user_id: userId,
      name: input.name,
      target_amount: input.target,
      currency: input.currency,
      deadline: input.deadline,
    });
    if (error) throw error;
  },

  /** Contributing to a goal is an update, not a ledger entry — goals track a balance. */
  async contributeToGoal(id: string, newAmount: number): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteGoal(id: string): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (error) throw error;
  },
};
