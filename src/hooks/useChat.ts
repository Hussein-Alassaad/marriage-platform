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

export function useSendVoice(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { audio: Blob; durationMs: number }) =>
      chatService.sendVoice(matchId, input.audio, input.durationMs),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', matchId] });
      if (result.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', result.conversationId] });
      }
    },
  });
}

/** Images only for now — video is disabled until it can be moderated at scale. */
export function useSendImage(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => chatService.sendImage(matchId, file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', matchId] });
      if (result.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', result.conversationId] });
      }
    },
  });
}

/** Signed playback URL, fetched lazily and cached until it nears expiry. */
export function useMediaUrl(messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['media-url', messageId],
    queryFn: () => chatService.getMediaUrl(messageId),
    enabled,
    staleTime: 8 * 60_000,
    gcTime: 9 * 60_000,
  });
}

/**
 * Suggested things to say next. Kept fresh against the conversation length so the
 * ideas move on as the conversation does, but not re-fetched on every render.
 */
export function useSuggestions(
  matchId: string,
  locale: string,
  messageCount: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['suggestions', matchId, locale, messageCount],
    queryFn: () => chatService.getSuggestions(matchId, locale),
    enabled: enabled && Boolean(matchId),
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/** Journey state — polled so a partner's consent shows up without a refresh. */
export function useStageStatus(matchId: string) {
  return useQuery({
    queryKey: ['stage-status', matchId],
    queryFn: () => chatService.getStageStatus(matchId),
    enabled: Boolean(matchId),
    refetchInterval: 15000,
  });
}

export function useStageConsent(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (consent: boolean) => chatService.setStageConsent(matchId, consent),
    onSuccess: (status) => {
      queryClient.setQueryData(['stage-status', matchId], status);
      if (status.advanced) {
        queryClient.invalidateQueries({ queryKey: ['match', matchId] });
        queryClient.invalidateQueries({ queryKey: ['connections'] });
      }
    },
  });
}

export function useEndConnection(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatService.endConnection(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}
