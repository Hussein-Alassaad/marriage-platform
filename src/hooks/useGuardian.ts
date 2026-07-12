import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { guardianService, type InviteInput } from '@/services/guardianService';

export function useMyGuardians() {
  return useQuery({ queryKey: ['my-guardians'], queryFn: () => guardianService.getMyGuardians() });
}

export function useInviteGuardian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteInput) => guardianService.invite(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-guardians'] }),
  });
}

export function useAcceptGuardianInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => guardianService.accept(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guardian-matches'] }),
  });
}

/** Sharing a connection is what actually unlocks the Family stage requirement. */
export function useSetMatchAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { matchId: string; guardianUserId: string; granted: boolean }) =>
      guardianService.setMatchAccess(input.matchId, input.guardianUserId, input.granted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-guardians'] });
      queryClient.invalidateQueries({ queryKey: ['stage-status'] });
    },
  });
}

export function useSharedMatches(enabled: boolean) {
  return useQuery({
    queryKey: ['guardian-matches'],
    queryFn: () => guardianService.getSharedMatches(),
    enabled,
  });
}
