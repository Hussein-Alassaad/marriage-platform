import { useState } from 'react';
import { Link } from 'react-router-dom';
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

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    const { error } = await authService.requestPasswordReset(email);
    if (error) {
      setFormError(error.message);
      return;
    }
    setSent(true);
  });

  return (
    <Card>
      <h1 className="text-ink text-xl font-semibold">{t('page.forgot.title')}</h1>
      <p className="text-muted mt-1 text-sm">{t('page.forgot.subtitle')}</p>

      {sent ? (
        <Alert variant="success">{t('page.forgot.sent')}</Alert>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <Alert>{formError}</Alert> : null}
          <FormField
            label={t('page.login.email')}
            htmlFor="email"
            error={errors.email && t('validation.email')}
          >
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
          </FormField>
          <Button size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.pleaseWait') : t('page.forgot.submit')}
          </Button>
        </form>
      )}

      <p className="text-muted mt-4 text-center text-sm">
        <Link to={ROUTES.login} className="text-brand-700 hover:text-brand-800 font-medium">
          {t('page.forgot.backToLogin')}
        </Link>
      </p>
    </Card>
  );
}
