import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { verificationService, type SubmitVerificationInput } from '@/services/verificationService';
import { useSession } from '@/hooks/useSession';

/** The signed-in user's latest identity-verification record (RLS: own only). */
export function useVerification() {
  const { user } = useSession();
  const userId = user?.id;
  return useQuery({
    queryKey: ['verification', userId],
    enabled: Boolean(userId),
    queryFn: () => verificationService.getMyVerification(userId as string),
  });
}

/** Submit an identity document via the verify-identity Edge Function. */
export function useSubmitVerification() {
  const { user, refreshProfile } = useSession();
  const queryClient = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: (input: SubmitVerificationInput) => verificationService.submit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification', userId] });
      void refreshProfile();
    },
  });
}
