import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/useSession';
import { assistantService } from '@/services/assistantService';

export function useChats() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['assistant-chats', user?.id],
    queryFn: () => assistantService.listChats(),
    enabled: Boolean(user?.id),
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: ['assistant-messages', chatId],
    queryFn: () => assistantService.listMessages(chatId as string),
    enabled: Boolean(chatId),
  });
}

export function useAskAssistant() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { text: string; locale: string; chatId?: string }) =>
      assistantService.send(input.text, input.locale, input.chatId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['assistant-messages', result.chatId] });
      queryClient.invalidateQueries({ queryKey: ['assistant-chats', user?.id] });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (id: string) => assistantService.deleteChat(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant-chats', user?.id] }),
  });
}

export function useMemory(enabled: boolean) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['assistant-memory', user?.id],
    queryFn: () => assistantService.listMemory(user?.id as string),
    enabled: enabled && Boolean(user?.id),
  });
}

export function useForget() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (id: string | 'all') =>
      id === 'all' ? assistantService.forgetAll(user?.id as string) : assistantService.forget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant-memory', user?.id] }),
  });
}
