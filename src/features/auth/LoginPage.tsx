import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ROUTES } from '@/app/routes';

/**
 * Placeholder sign-in screen. Real authentication (email/password + phone OTP)
 * arrives in Phase 3; the form is intentionally disabled for now.
 */
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <Card>
      <h1 className="text-xl font-semibold text-ink">{t('page.login.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('page.login.subtitle')}</p>

      <form className="mt-6 flex flex-col gap-4" aria-disabled>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t('page.login.email')}
          <Input type="email" autoComplete="email" disabled placeholder="name@example.com" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t('page.login.password')}
          <Input type="password" autoComplete="current-password" disabled />
        </label>
        <Button size="lg" disabled>
          {t('page.login.submit')}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted">{t('page.login.phase')}</p>
      <p className="mt-4 text-center text-sm text-muted">
        {t('page.login.noAccount')}{' '}
        <Link to={ROUTES.register} className="font-medium text-brand-700 hover:text-brand-800">
          {t('page.login.registerLink')}
        </Link>
      </p>
    </Card>
  );
}
