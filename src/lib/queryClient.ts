import { QueryClient } from '@tanstack/react-query';

/**
 * Single React Query client for all server state (profiles, matches, messages,
 * finance, …). Realtime events will push into this cache in later phases rather
 * than creating a parallel state system.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
