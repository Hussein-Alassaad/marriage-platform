import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { FormField } from '@/components/FormField';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { useAcceptGuardianInvite } from '@/hooks/useGuardian';

/**
 * Where an invited guardian redeems their code. Accepting requires an explicit
 * declaration that they are authorised to act as her guardian — the platform
 * records the declaration, and never claims to have verified the relationship
 * itself (Decisions §9).
 */
export function GuardianAcceptPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshProfile } = useSession();
  const accept = useAcceptGuardianInvite();

  const [code, setCode] = useState(params.get('code') ?? '');
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await accept.mutateAsync(code.trim());
      // The `guardian` role was just granted — reload it so the guard lets them in.
      await refreshProfile();
      navigate(ROUTES.guardian);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        message === 'code_expired'
          ? t('guardians.accept.expired')
          : message === 'invalid_code'
            ? t('guardians.accept.invalid')
            : t('guardians.accept.error'),
      );
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t('guardians.accept.title')} subtitle={t('guardians.accept.subtitle')} />

      <Card className="p-6">
        <FormField label={t('guardians.accept.code')} htmlFor="invite_code">
          <Input
            id="invite_code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('guardians.accept.codePlaceholder')}
            className="font-mono uppercase tracking-[0.2em]"
          />
        </FormField>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-bg-3 p-4">
          <input
            type="checkbox"
            checked={declared}
            onChange={(e) => setDeclared(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-brand-500)]"
          />
          <span className="text-sm leading-relaxed text-ink-soft">{t('guardians.accept.declaration')}</span>
        </label>

        {error ? <p className="mt-4 text-xs text-danger">{error}</p> : null}

        <Button
          className="mt-6"
          fullWidth
          onClick={submit}
          disabled={accept.isPending || !code.trim() || !declared}
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {t('guardians.accept.confirm')}
        </Button>
      </Card>
    </div>
  );
}
