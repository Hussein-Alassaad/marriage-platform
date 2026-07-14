import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/useSession';
import {
  subscriptionService,
  type BillingPeriod,
  type ManualMethod,
  type Tier,
} from '@/services/subscriptionService';

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => subscriptionService.listPlans(),
    staleTime: 5 * 60_000,
  });
}

export function useMySubscription() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => subscriptionService.getMySubscription(user?.id as string),
    enabled: Boolean(user?.id),
  });
}

/** The latest manual payment claim — drives the "pending review" state. */
export function useMyClaim() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['payment-claim', user?.id],
    queryFn: () => subscriptionService.getMyClaim(user?.id as string),
    enabled: Boolean(user?.id),
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { tier: Tier; method: ManualMethod; period: BillingPeriod }) =>
      subscriptionService.createClaim(input.tier, input.method, input.period),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-claim', user?.id] }),
  });
}

export function useUploadReceipt() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { claimId: string; file: File }) =>
      subscriptionService.uploadReceipt(user?.id as string, input.claimId, input.file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-claim', user?.id] }),
  });
}

export function usePendingClaims(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-claims'],
    queryFn: () => subscriptionService.listPendingClaims(),
    enabled,
  });
}

export function useReviewClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { claimId: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      subscriptionService.reviewClaim(input.claimId, input.decision, input.reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-claims'] }),
  });
}
