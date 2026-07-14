import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/useSession';
import { notificationService, type NotificationPrefs } from '@/services/notificationService';

/** Matches the chat convention: gentle polling rather than a realtime subscription. */
const POLL_MS = 30_000;

export function useNotifications() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.list(user?.id as string),
    enabled: Boolean(user?.id),
    refetchInterval: POLL_MS,
  });
}

/** Drives the bell badge — cheap (count-only query), so it can poll everywhere. */
export function useUnreadCount() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ['notifications-unread', user?.id],
    queryFn: () => notificationService.unreadCount(user?.id as string),
    enabled: Boolean(user?.id),
    refetchInterval: POLL_MS,
  });
  return query.data ?? 0;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread', user?.id] });
  };
}

export function useMarkRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const { user } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(user?.id as string),
    onSuccess: invalidate,
  });
}

export function useDismissNotification() {
  const { user } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => notificationService.dismiss(id, user?.id as string),
    onSuccess: invalidate,
  });
}

export function useNotificationPrefs() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: () => notificationService.getPrefs(user?.id as string),
    enabled: Boolean(user?.id),
  });
}

export function useSavePrefs() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      notificationService.savePrefs(user?.id as string, prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-prefs', user?.id] }),
  });
}
