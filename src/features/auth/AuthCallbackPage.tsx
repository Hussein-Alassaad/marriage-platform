import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/hooks/useSession';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { ROUTES } from '@/app/routes';

/**
 * Landing route for email-confirmation / magic links. Supabase's
 * detectSessionInUrl establishes the session from the URL; once the session is
 * present we forward into the app. If it never arrives, offer a way back.
 */
export function AuthCallbackPage() {
  const { isAuthenticated, isLoading } = useSession();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isAuthenticated) navigate(ROUTES.home, { replace: true });
  }, [isAuthenticated, navigate]);

  if (isLoading || isAuthenticated) return <FullScreenLoader />;

  return (
    <div className="app-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="text-center">
          <h1 className="text-ink text-lg font-semibold">{t('page.authCallback.title')}</h1>
          <p className="text-muted mt-2 text-sm">{t('page.authCallback.body')}</p>
          <Link to={ROUTES.login} className="mt-6 inline-block">
            <Button>{t('page.authCallback.cta')}</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
