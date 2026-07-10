import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { matchService } from '@/services/matchService';
import { useSession } from '@/hooks/useSession';

export function useDiscover() {
  return useQuery({ queryKey: ['discover'], queryFn: matchService.discover });
}

export function useConnections() {
  return useQuery({ queryKey: ['connections'], queryFn: matchService.connections });
}

export function useSendInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recipientId, note }: { recipientId: string; note?: string }) =>
      matchService.sendInterest(recipientId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

export function useRespondInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ interestId, decision }: { interestId: string; decision: 'accepted' | 'declined' }) =>
      matchService.respondInterest(interestId, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useCandidateActions() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const uid = user?.id;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discover'] });

  const save = useMutation({
    mutationFn: ({ candidateId, saved }: { candidateId: string; saved: boolean }) =>
      saved ? matchService.unsave(uid as string, candidateId) : matchService.save(uid as string, candidateId),
    onSuccess: invalidate,
  });
  const decline = useMutation({
    mutationFn: (candidateId: string) => matchService.decline(uid as string, candidateId),
    onSuccess: invalidate,
  });
  const markViewed = (candidateId: string) => {
    if (uid) void matchService.markViewed(uid, candidateId);
  };
  return { save, decline, markViewed };
}
