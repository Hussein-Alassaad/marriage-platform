import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';

import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { ROUTES } from '@/app/routes';
import { authService } from '@/services/authService';
import { useSettings } from '@/hooks/useSettings';

function ageOnDate(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { number } = useSettings();
  const minAge = number('min_age', 18); // configurable, never hardcoded
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  // Schema depends on the runtime min_age setting.
  const schema = useMemo(
    () =>
      z.object({
        displayName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        gender: z.enum(['man', 'woman']),
        dob: z
          .string()
          .min(1)
          .refine((value) => ageOnDate(value) >= minAge, { params: { minAge } }),
      }),
    [minAge],
  );
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { data, error } = await authService.signUp({
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      gender: values.gender,
      dob: values.dob,
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    if (data.session) {
      navigate(ROUTES.home, { replace: true }); // email confirmation disabled
    } else {
      setSubmittedEmail(values.email); // confirmation email sent
    }
  });

  if (submittedEmail) {
    return (
      <Card>
        <EmptyState
          icon={MailCheck}
          title={t('page.register.checkEmailTitle')}
          description={t('page.register.checkEmailBody', { email: submittedEmail })}
          action={
            <Link to={ROUTES.login}>
              <Button variant="outline">{t('page.register.loginLink')}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-ink">{t('page.register.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('page.register.subtitle')}</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert>{formError}</Alert> : null}

        <FormField
          label={t('page.register.displayName')}
          htmlFor="displayName"
          error={errors.displayName && t('validation.displayName')}
        >
          <Input id="displayName" autoComplete="name" {...register('displayName')} />
        </FormField>

        <FormField label={t('page.register.email')} htmlFor="email" error={errors.email && t('validation.email')}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField
          label={t('page.register.password')}
          htmlFor="password"
          error={errors.password && t('validation.password')}
        >
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={t('page.register.gender')}
            htmlFor="gender"
            error={errors.gender && t('validation.gender')}
          >
            <Select id="gender" defaultValue="" {...register('gender')}>
              <option value="" disabled>
                {t('page.register.genderPlaceholder')}
              </option>
              <option value="man">{t('gender.man')}</option>
              <option value="woman">{t('gender.woman')}</option>
            </Select>
          </FormField>

          <FormField
            label={t('page.register.dob')}
            htmlFor="dob"
            error={errors.dob && t('validation.minAge', { minAge })}
          >
            <Input id="dob" type="date" {...register('dob')} />
          </FormField>
        </div>

        <p className="text-xs text-muted">{t('page.register.genderNote')}</p>

        <Button size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('common.pleaseWait') : t('page.register.submit')}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        {t('page.register.hasAccount')}{' '}
        <Link to={ROUTES.login} className="font-medium text-brand-700 hover:text-brand-800">
          {t('page.register.loginLink')}
        </Link>
      </p>
    </Card>
  );
}
