import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminService } from '@/services/adminService';

export function useAdminOverview() {
  return useQuery({ queryKey: ['admin-overview'], queryFn: () => adminService.overview() });
}

export function useHealth() {
  return useQuery({
    queryKey: ['admin-health'],
    queryFn: () => adminService.health(),
    refetchInterval: 60_000,
  });
}

export function useAdminSettings(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminService.listSettings(),
    enabled,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: unknown }) =>
      adminService.updateSetting(input.key, input.value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      // Every feature reads its limits from here — a stale cache would show the old cap.
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
    },
  });
}

export function useAdminUsers(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => adminService.searchUsers(query),
    enabled,
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      status: 'active' | 'suspended' | 'banned';
      days?: number;
      reason?: string;
    }) => adminService.setUserStatus(input.userId, input.status, input.days, input.reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useVerificationQueue(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-verifications'],
    queryFn: () => adminService.verificationQueue(),
    enabled,
    // The signed document URLs expire in ten minutes; don't hand back a dead link.
    staleTime: 5 * 60_000,
  });
}

export function useReviewVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; decision: 'verified' | 'rejected'; reason?: string }) =>
      adminService.reviewVerification(input.id, input.decision, input.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useJobs(enabled: boolean) {
  return useQuery({ queryKey: ['admin-jobs'], queryFn: () => adminService.listJobs(), enabled });
}

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminService.runJob(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });
}

export function useToggleJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; enabled: boolean }) =>
      adminService.toggleJob(input.name, input.enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-jobs'] }),
  });
}

export function useAnalytics(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-analytics', days],
    queryFn: () => adminService.analytics(days),
    enabled,
  });
}

export function useCoupons(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => adminService.listCoupons(),
    enabled,
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof adminService.createCoupon>[0]) =>
      adminService.createCoupon(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });
}

export function useToggleCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      adminService.toggleCoupon(input.id, input.active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });
}

export function useAuditLog(enabled: boolean) {
  return useQuery({ queryKey: ['admin-audit'], queryFn: () => adminService.auditLog(), enabled });
}

export function useTickets(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => adminService.listTickets(),
    enabled,
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      adminService.updateTicket(input.id, input.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tickets'] }),
  });
}
