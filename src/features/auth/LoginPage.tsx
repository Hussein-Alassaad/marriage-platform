import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/Alert';
import { ROUTES } from '@/app/routes';
import { authService } from '@/services/authService';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? ROUTES.home;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    const { error } = await authService.signIn(email, password);
    if (error) {
      setFormError(error.message);
      return;
    }
    navigate(from, { replace: true });
  });

  return (
    <Card>
      <h1 className="text-xl font-semibold text-ink">{t('page.login.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('page.login.subtitle')}</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert>{formError}</Alert> : null}

        <FormField label={t('page.login.email')} htmlFor="email" error={errors.email && t('validation.email')}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField
          label={t('page.login.password')}
          htmlFor="password"
          error={errors.password && t('validation.required')}
        >
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
        </FormField>

        <div className="flex justify-end">
          <Link to={ROUTES.forgotPassword} className="text-sm font-medium text-brand-700 hover:text-brand-800">
            {t('page.login.forgot')}
          </Link>
        </div>

        <Button size="lg" type="submit" magnetic disabled={isSubmitting}>
          {isSubmitting ? t('common.pleaseWait') : t('page.login.submit')}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        {t('page.login.noAccount')}{' '}
        <Link to={ROUTES.register} className="font-medium text-brand-700 hover:text-brand-800">
          {t('page.login.registerLink')}
        </Link>
      </p>
    </Card>
  );
}
