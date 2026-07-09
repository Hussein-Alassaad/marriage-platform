import { useState } from 'react';
import { PhoneCall, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/Alert';
import { PageHeader } from '@/components/PageHeader';
import { authService } from '@/services/authService';
import { useSession } from '@/hooks/useSession';

/**
 * Phone verification. Fully wired to Supabase Auth (updateUser → OTP →
 * verifyOtp). Requires an SMS provider configured in Supabase Auth; until then
 * "send code" returns a provider error, which we surface cleanly. See
 * docs/Deployment.md for the required external setup.
 */
export function PhoneVerificationPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'enter_phone' | 'enter_code' | 'done'>(
    user?.phone_confirmed_at ? 'done' : 'enter_phone',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await authService.startPhoneVerification(phone);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep('enter_code');
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await authService.verifyPhone(phone, code);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep('done');
  };

  return (
    <>
      <PageHeader title={t('page.phone.title')} subtitle={t('page.phone.subtitle')} />
      <Card className="max-w-md">
        {step === 'done' ? (
          <div className="flex items-center gap-3 text-brand-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            <span className="text-sm font-medium">{t('page.phone.verified')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {error ? <Alert>{error}</Alert> : null}

            {step === 'enter_phone' ? (
              <>
                <FormField label={t('page.phone.phone')} htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+9617XXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </FormField>
                <Button onClick={sendCode} disabled={busy || phone.length < 6}>
                  <PhoneCall className="h-4 w-4" aria-hidden />
                  {busy ? t('common.pleaseWait') : t('page.phone.sendCode')}
                </Button>
              </>
            ) : (
              <>
                <FormField label={t('page.phone.code')} htmlFor="code">
                  <Input
                    id="code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </FormField>
                <Button onClick={verify} disabled={busy || code.length < 4}>
                  {busy ? t('common.pleaseWait') : t('page.phone.verify')}
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
