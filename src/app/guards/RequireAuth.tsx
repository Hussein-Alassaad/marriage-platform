import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSession } from '@/hooks/useSession';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { ROUTES } from '@/app/routes';

/**
 * Gate for authenticated routes. Frontend gate for UX only — the database (RLS)
 * is the real boundary. Preserves the attempted location for post-login return.
 */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }
  return <Outlet />;
}
