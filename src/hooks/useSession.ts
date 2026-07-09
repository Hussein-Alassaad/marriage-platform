import { useContext } from 'react';

import { SessionContext, type SessionContextValue } from '@/contexts/SessionContext';

/** Access the current auth session, profile, roles, and auth actions. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
