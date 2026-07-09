import { useQuery } from '@tanstack/react-query';

import { fetchPublicSettings, settingNumber, type PublicSettings } from '@/services/settingsService';

/**
 * Public platform settings, cached via React Query. Features read tunables from
 * here (e.g. min age) instead of hardcoding them. `number(key, fallback)` coerces
 * safely so the UI still works before the query resolves.
 */
export function useSettings() {
  const query = useQuery({
    queryKey: ['public-settings'],
    queryFn: fetchPublicSettings,
    staleTime: 5 * 60_000,
  });

  const settings: PublicSettings = query.data ?? {};

  return {
    settings,
    isLoading: query.isLoading,
    number: (key: string, fallback: number) => settingNumber(settings, key, fallback),
  };
}
