import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/useSession';
import { useSettings } from '@/hooks/useSettings';
import { financeService, type EntryKind } from '@/services/financeService';
import { toRateMap } from '@/utils/money';

/** How far back the ledger loads. A year covers every chart we draw. */
function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function useRates() {
  const query = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => financeService.listRates(),
    staleTime: 60 * 60_000, // rates move daily at most
  });
  const rates = useMemo(() => toRateMap(query.data ?? []), [query.data]);
  return { rates, isLoading: query.isLoading };
}

/** The member's display currency, defaulting to the platform setting until they pick one. */
export function usePrimaryCurrency() {
  const { user } = useSession();
  const { text } = useSettings();
  const fallback = text('finance_default_currency', 'USD');
  const query = useQuery({
    queryKey: ['finance-currency', user?.id],
    queryFn: () => financeService.getPrimaryCurrency(user?.id as string, fallback),
    enabled: Boolean(user?.id),
  });
  return { currency: query.data ?? fallback, isLoading: query.isLoading };
}

export function useSetPrimaryCurrency() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (currency: string) =>
      financeService.setPrimaryCurrency(user?.id as string, currency),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-currency', user?.id] }),
  });
}

export function useEntries() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['finance-entries', user?.id],
    queryFn: () => financeService.listEntries(user?.id as string, oneYearAgo()),
    enabled: Boolean(user?.id),
  });
}

export function useAddEntry() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: {
      kind: EntryKind;
      label: string;
      amount: number;
      currency: string;
      occurredOn: string;
      recurring: boolean;
    }) => financeService.addEntry(user?.id as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-entries', user?.id] }),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { kind: EntryKind; id: string }) =>
      financeService.deleteEntry(input.kind, input.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-entries', user?.id] }),
  });
}

export function useBudgets(enabled: boolean) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['finance-budgets', user?.id],
    queryFn: () => financeService.listBudgets(user?.id as string),
    enabled: enabled && Boolean(user?.id),
  });
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { category: string; amount: number; currency: string }) =>
      financeService.saveBudget(user?.id as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-budgets', user?.id] }),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (id: string) => financeService.deleteBudget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-budgets', user?.id] }),
  });
}

export function useGoals(enabled: boolean) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['finance-goals', user?.id],
    queryFn: () => financeService.listGoals(user?.id as string),
    enabled: enabled && Boolean(user?.id),
  });
}

export function useSaveGoal() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: {
      name: string;
      target: number;
      currency: string;
      deadline: string | null;
    }) => financeService.saveGoal(user?.id as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-goals', user?.id] }),
  });
}

export function useContributeToGoal() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { id: string; newAmount: number }) =>
      financeService.contributeToGoal(input.id, input.newAmount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-goals', user?.id] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (id: string) => financeService.deleteGoal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-goals', user?.id] }),
  });
}
