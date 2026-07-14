import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  computeCompletion,
  profileService,
  type ProfilePatch,
  type ProfileRecord,
} from '@/services/profileService';
import { useSession } from '@/hooks/useSession';

/** The signed-in user's full marriage profile (React Query cached). */
export function useProfile() {
  const { user } = useSession();
  const userId = user?.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: () => profileService.getMyProfile(userId as string),
    staleTime: 60_000,
  });
}

/**
 * Patch the profile. Recomputes `profile_completion` from the merged result,
 * refreshes the session profile (so nav badges update), and invalidates the
 * cached profile query. RLS + DB triggers remain the real boundary.
 */
export function useUpdateProfile() {
  const { user, refreshProfile } = useSession();
  const queryClient = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({
      patch,
      current,
    }: {
      patch: ProfilePatch;
      current: ProfileRecord | null;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const merged = { ...(current ?? {}), ...patch } as ProfileRecord;
      const withCompletion: ProfilePatch = {
        ...patch,
        profile_completion: computeCompletion(merged),
      };
      return profileService.updateMyProfile(userId, withCompletion);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile', userId], updated);
      void refreshProfile();
    },
  });
}
