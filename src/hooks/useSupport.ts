import { useMutation } from '@tanstack/react-query';

import { useSession } from '@/hooks/useSession';
import { supportService, type TicketCategory } from '@/services/supportService';

export function useCreateTicket() {
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: { category: TicketCategory; subject: string; body: string }) =>
      supportService.createTicket(user?.id as string, input),
  });
}
