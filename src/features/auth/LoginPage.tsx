import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { Logo } from '@/components/Logo';
import { RevealText } from '@/components/motion/RevealText';
import { FadeRise } from '@/components/motion/FadeRise';
import { ConfettiBurst } from '@/components/motion/ConfettiBurst';
import { AuthField } from './scene/AuthField';
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
  const [succeeded, setSucceeded] = useState(false);

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
    // Barakah moment — confetti — then continue.
    setSucceeded(true);
    setTimeout(() => navigate(from, { replace: true }), 1100);
  });

  return (
    <div className="relative px-6 py-8 sm:px-9 sm:py-10">
      {/* Gold geometric watermark (Barakah texture), bottom-end corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-28 w-28 opacity-[0.06] ltr:right-0 rtl:left-0"
        style={{
          background:
            'radial-gradient(circle at 70% 70%, var(--color-gold-400), transparent 60%)',
        }}
      />
      <ConfettiBurst active={succeeded} />

      {/* In-card header (centered brand lockup) */}
      <div className="flex flex-col items-center text-center">
        <Logo />
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-400">
          {t('common.tagline')}
        </p>
      </div>

      <h1 className="mt-5 text-center font-display text-[clamp(30px,4vw,40px)] font-semibold leading-[1.1] text-ink">
        <RevealText text={t('page.login.title')} />
      </h1>
      <FadeRise immediate delay={0.25}>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted">{t('page.login.subtitle')}</p>
      </FadeRise>

      <form className="mt-7 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert>{formError}</Alert> : null}

        <FadeRise immediate delay={0.36}>
          <AuthField
            id="email"
            label={t('page.login.email')}
            icon={Mail}
            type="email"
            autoComplete="email"
            registration={register('email')}
            error={errors.email && t('validation.email')}
          />
        </FadeRise>

        <FadeRise immediate delay={0.44}>
          <AuthField
            id="password"
            label={t('page.login.password')}
            icon={Lock}
            isPassword
            autoComplete="current-password"
            registration={register('password')}
            error={errors.password && t('validation.required')}
          />
        </FadeRise>

        <div className="flex justify-end">
          <Link
            to={ROUTES.forgotPassword}
            className="text-sm font-medium text-brand-400 underline-offset-4 hover:underline"
          >
            {t('page.login.forgot')}
          </Link>
        </div>

        <FadeRise immediate delay={0.52}>
          <Button size="lg" type="submit" magnetic fullWidth disabled={isSubmitting || succeeded}>
            {succeeded ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex">
                <Check className="h-5 w-5" aria-hidden />
              </motion.span>
            ) : isSubmitting ? (
              <span className="h-[18px] w-[18px] animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                {t('page.login.submit')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </>
            )}
          </Button>
        </FadeRise>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {t('page.login.noAccount')}{' '}
        <Link to={ROUTES.register} className="font-semibold text-brand-400 hover:text-brand-300">
          {t('page.login.registerLink')}
        </Link>
      </p>
    </div>
  );
}
