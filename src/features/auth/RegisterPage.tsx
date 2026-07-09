import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ROUTES } from '@/app/routes';

/**
 * Placeholder registration screen. Real sign-up (with gender + DOB vs.
 * configurable min age) arrives in Phase 3; the form is disabled for now.
 */
export function RegisterPage() {
  const { t } = useTranslation();
  return (
    <Card>
      <h1 className="text-xl font-semibold text-ink">{t('page.register.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('page.register.subtitle')}</p>

      <form className="mt-6 flex flex-col gap-4" aria-disabled>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t('page.register.email')}
          <Input type="email" autoComplete="email" disabled placeholder="name@example.com" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t('page.register.password')}
          <Input type="password" autoComplete="new-password" disabled />
        </label>
        <Button size="lg" disabled>
          {t('page.register.submit')}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted">{t('page.register.phase')}</p>
      <p className="mt-4 text-center text-sm text-muted">
        {t('page.register.hasAccount')}{' '}
        <Link to={ROUTES.login} className="font-medium text-brand-700 hover:text-brand-800">
          {t('page.register.loginLink')}
        </Link>
      </p>
    </Card>
  );
}
