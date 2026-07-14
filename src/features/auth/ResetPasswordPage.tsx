import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const schema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'] });
type FormValues = z.infer<typeof schema>;

/**
 * Reached from the password-recovery email link. Supabase establishes a recovery
 * session (detectSessionInUrl), so updateUser({ password }) is authorized here.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    const { error } = await authService.updatePassword(password);
    if (error) {
      setFormError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate(ROUTES.home, { replace: true }), 1200);
  });

  return (
    <Card>
      <h1 className="text-ink text-xl font-semibold">{t('page.reset.title')}</h1>
      <p className="text-muted mt-1 text-sm">{t('page.reset.subtitle')}</p>

      {done ? (
        <Alert variant="success">{t('page.reset.done')}</Alert>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <Alert>{formError}</Alert> : null}
          <FormField
            label={t('page.reset.password')}
            htmlFor="password"
            error={errors.password && t('validation.password')}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          </FormField>
          <FormField
            label={t('page.reset.confirm')}
            htmlFor="confirm"
            error={errors.confirm && t('validation.passwordMatch')}
          >
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register('confirm')}
            />
          </FormField>
          <Button size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.pleaseWait') : t('page.reset.submit')}
          </Button>
        </form>
      )}
    </Card>
  );
}
