import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chatService } from '@/services/chatService';
import { useSession } from '@/hooks/useSession';

export function useConversationId(matchId: string) {
  return useQuery({
    queryKey: ['conversation', matchId],
    queryFn: () => chatService.getConversationId(matchId),
    enabled: Boolean(matchId),
  });
}

/** Messages for a conversation, gently polled so both sides stay near-live. */
export function useMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => chatService.listMessages(conversationId as string),
    enabled: Boolean(conversationId),
    refetchInterval: 4000,
  });
}

export function useSentCount(conversationId: string | null | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['message-counter', conversationId, user?.id],
    queryFn: () => chatService.getSentCount(conversationId as string, user?.id as string),
    enabled: Boolean(conversationId && user?.id),
  });
}

export function useSendText(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => chatService.sendText(matchId, body),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', matchId] });
      if (result.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', result.conversationId] });
        queryClient.invalidateQueries({ queryKey: ['message-counter', result.conversationId] });
      }
    },
  });
}
