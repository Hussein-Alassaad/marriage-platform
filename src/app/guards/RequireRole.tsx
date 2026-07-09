import { Navigate, Outlet } from 'react-router-dom';

import { useSession } from '@/hooks/useSession';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { ROUTES } from '@/app/routes';
import type { AppRole } from '@/services/authService';

/**
 * Gate for role-scoped routes (admin, guardian). UX only — RLS + Edge Function
 * role checks are the real enforcement. Silently redirects home if unauthorized.
 */
export function RequireRole({ roles }: { roles: AppRole[] }) {
  const { isLoading, hasRole } = useSession();

  if (isLoading) return <FullScreenLoader />;
  if (!hasRole(...roles)) {
    return <Navigate to={ROUTES.home} replace />;
  }
  return <Outlet />;
}
