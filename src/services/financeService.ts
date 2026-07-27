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

/** Consent state for one couple. The function works out which side of the match you are. */
export interface SharedStatus {
  active: boolean;
  myConsent: boolean;
  partnerConsent: boolean;
  married: boolean;
  partnerName: string | null;
  /** Both spouses hold the required tier — one cannot buy it on the other's behalf. */
  tiersOk: boolean;
  minTier: string;
  /** Marriage Plus, on top of the totals every Serious+ couple already gets. */
  advancedUnlocked: boolean;
  advancedMinTier: string;
}

/** A joint budget: the target vs. the SUM of both spouses' spending — never either
 *  person's individual entries. */
export interface SharedBudget {
  id: string;
  category: string;
  amount: number;
  currency: string;
  spent: number;
  unconvertible: number;
  overBudget: boolean;
}

/** A joint running balance either spouse can add to — a shared jar, not a ledger of
 *  who contributed what. */
export interface SharedGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  deadline: string | null;
}

/** Monthly totals, grouped by the currency each amount was entered in. */
export interface Totals {
  currency: string;
  income: number;
  expenses: number;
}

export interface SharedSummary {
  mine: Totals[];
  theirs: Totals[];
  partnerName: string | null;
}

export interface ReportCategoryAmount {
  category: string;
  amount: number;
}

export interface ReportBudget {
  category: string;
  budgeted: number;
  currency: string;
  spent: number;
  overBudget: boolean;
}

export interface ReportGoal {
  name: string;
  target: number;
  current: number;
  currency: string;
  progressPct: number;
}

export interface ReportData {
  currency: string;
  income: number;
  expenses: number;
  net: number;
  unconvertible: number;
  byCategory: ReportCategoryAmount[];
  budgets: ReportBudget[];
  goals: ReportGoal[];
  previous: { income: number; expenses: number; net: number };
  narrative: string | null;
}

/** One frozen monthly snapshot — generated server-side, never client-written. */
export interface Report {
  id: string;
  period: string; // 'YYYY-MM'
  data: ReportData;
  created_at: string;
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

  /** Kind is fixed on edit — changing it would mean moving the row between the
   *  `income`/`expenses` tables, which is a bigger operation than "edit this entry". */
  async updateEntry(
    kind: EntryKind,
    id: string,
    input: { label: string; amount: number; currency: string; occurredOn: string; recurring: boolean },
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const common = {
      amount: input.amount,
      currency: input.currency,
      occurred_on: input.occurredOn,
      recurring: input.recurring,
    };
    const { error } =
      kind === 'income'
        ? await supabase.from('income').update({ ...common, source: input.label }).eq('id', id)
        : await supabase.from('expenses').update({ ...common, category: input.label }).eq('id', id);
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

  /** Category is fixed on edit (one budget per category) — only amount/currency change. */
  async updateBudget(id: string, input: { amount: number; currency: string }): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('budgets')
      .update({ amount: input.amount, currency: input.currency })
      .eq('id', id);
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

  /** Editing the goal's own fields — distinct from contributeToGoal, which only ever
   *  touches current_amount (the running balance a contribution adds to). */
  async updateGoal(
    id: string,
    input: { name: string; target: number; currency: string; deadline: string | null },
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
      .from('savings_goals')
      .update({
        name: input.name,
        target_amount: input.target,
        currency: input.currency,
        deadline: input.deadline,
      })
      .eq('id', id);
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

  // ── Shared (couple) finance — Married Stage only, and never a client write ──

  /** The member's married connection, if they have one. RLS: participants only. */
  async getMarriedMatchId(userId: string): Promise<string | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('matches')
      .select('id')
      .eq('stage', 'married')
      .is('deleted_at', null)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  },

  async sharedStatus(matchId: string): Promise<SharedStatus> {
    return invokeFinance<SharedStatus>('shared-status', matchId);
  },

  /** Records MY consent. Activates only when the other side has consented too. */
  async sharedConsent(matchId: string): Promise<SharedStatus> {
    return invokeFinance<SharedStatus>('shared-consent', matchId);
  },

  /** Either side, alone. Leaving never needs the other spouse's signature. */
  async sharedDisconnect(matchId: string): Promise<SharedStatus> {
    return invokeFinance<SharedStatus>('shared-disconnect', matchId);
  },

  /** Monthly totals for both spouses — never the individual entries. */
  async sharedSummary(matchId: string): Promise<SharedSummary> {
    return invokeFinance<SharedSummary>('shared-summary', matchId);
  },

  // ── Marriage Plus: shared budgets + shared goals ──

  async sharedBudgets(matchId: string): Promise<SharedBudget[]> {
    const { budgets } = await invokeFinance<{ budgets: SharedBudget[] }>('shared-budgets', matchId);
    return budgets;
  },

  async saveSharedBudget(
    matchId: string,
    input: { category: string; amount: number; currency: string },
  ): Promise<void> {
    await invokeFinance('shared-budget-save', matchId, input);
  },

  async deleteSharedBudget(matchId: string, id: string): Promise<void> {
    await invokeFinance('shared-budget-delete', matchId, { id });
  },

  async sharedGoals(matchId: string): Promise<SharedGoal[]> {
    const { goals } = await invokeFinance<{ goals: SharedGoal[] }>('shared-goals', matchId);
    return goals;
  },

  /** `id` present = edit that goal's own fields; absent = create a new one. */
  async saveSharedGoal(
    matchId: string,
    input: { id?: string; name: string; target: number; currency: string; deadline: string | null },
  ): Promise<void> {
    await invokeFinance('shared-goal-save', matchId, input);
  },

  async contributeSharedGoal(matchId: string, id: string, newAmount: number): Promise<void> {
    await invokeFinance('shared-goal-contribute', matchId, { id, newAmount });
  },

  async deleteSharedGoal(matchId: string, id: string): Promise<void> {
    await invokeFinance('shared-goal-delete', matchId, { id });
  },

  // ── Monthly reports — server-generated (cron), client only ever reads ──

  /** Own reports, newest period first. Plain RLS read — engine-written, never client-inserted. */
  async listReports(userId: string): Promise<Report[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('financial_reports')
      .select('id, period, data, created_at')
      .eq('user_id', userId)
      .is('match_id', null)
      .order('period', { ascending: false })
      .limit(12);
    if (error) throw error;
    return (data ?? []) as Report[];
  },

  /** Generates (or returns the cached) AI paragraph for one report. Null if no key yet. */
  async reportNarrative(reportId: string, locale: string): Promise<string | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('finance', {
      body: { action: 'report-narrative', reportId, locale },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.narrative as string | null) ?? null;
  },
};

async function invokeFinance<T>(
  action: string,
  matchId: string,
  extra: Record<string, unknown> = {},
): Promise<T> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('finance', {
    body: { action, matchId, ...extra },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}
