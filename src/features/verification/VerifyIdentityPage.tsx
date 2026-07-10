import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Clock, FileText, Lock, ShieldAlert, ShieldCheck, UploadCloud } from 'lucide-react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/utils/cn';
import { ROUTES } from '@/app/routes';
import { useSession } from '@/hooks/useSession';
import { useVerification, useSubmitVerification } from '@/hooks/useVerification';

const DOC_TYPES = ['passport', 'national_id', 'residence_permit'] as const;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

function StatePanel({ icon: Icon, tone, title, body, children }: {
  icon: typeof ShieldCheck;
  tone: 'brand' | 'gold' | 'warning';
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const ring = tone === 'gold' ? 'ring-gold-500/30 bg-gold-wash text-gold-400' : tone === 'warning' ? 'ring-warning/25 bg-warning-wash text-warning' : 'ring-[color:var(--color-border-accent)] bg-brand-wash text-brand-500';
  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center">
      <span className={cn('grid h-16 w-16 place-items-center rounded-full ring-1 ring-inset', ring)}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      </div>
      {children}
    </Card>
  );
}

export function VerifyIdentityPage() {
  const { t } = useTranslation();
  const { verificationStatus } = useSession();
  const { data: record, isLoading } = useVerification();
  const submit = useSubmitVerification();

  const [documentType, setDocumentType] = useState<string>('passport');
  const [document, setDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const status = verificationStatus === 'verified' ? 'verified' : record?.status ?? 'unverified';

  const onSubmit = async () => {
    setError(null);
    if (!document) return setError(t('verify.errorNoDocument'));
    if (!ALLOWED.includes(document.type) || document.size > MAX_BYTES) return setError(t('verify.errorFile'));
    try {
      await submit.mutateAsync({ document, selfie, documentType });
      setDocument(null);
      setSelfie(null);
    } catch {
      setError(t('verify.errorService'));
    }
  };

  const filePicker = (
    file: File | null,
    ref: RefObject<HTMLInputElement>,
    onPick: (f: File | null) => void,
    labelKey: string,
    optional?: boolean,
  ) => (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong bg-bg-3/40 p-4 text-start transition-colors hover:border-[color:var(--color-border-accent)]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-wash text-brand-600">
          {file ? <FileText className="h-5 w-5" aria-hidden /> : <UploadCloud className="h-5 w-5" aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{file ? file.name : t(labelKey)}</span>
          <span className="block text-xs text-muted">{optional ? t('verify.selfieHint') : t('verify.fileHint')}</span>
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t('verify.title')} subtitle={t('verify.subtitle')} />

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-card" />
      ) : status === 'verified' ? (
        <StatePanel icon={BadgeCheck} tone="gold" title={t('verify.verifiedTitle')} body={t('verify.verifiedBody')}>
          <Link to={ROUTES.match}>
            <Button variant="gold" magnetic>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {t('verify.goToMatch')}
            </Button>
          </Link>
        </StatePanel>
      ) : status === 'pending' ? (
        <StatePanel icon={Clock} tone="brand" title={t('verify.pendingTitle')} body={t('verify.pendingBody')}>
          <Badge variant="brand" withDot pulse>
            {t('verification.status.pending')}
          </Badge>
        </StatePanel>
      ) : (
        <div className="flex flex-col gap-5">
          {status === 'rejected' ? (
            <StatePanel icon={ShieldAlert} tone="warning" title={t('verify.rejectedTitle')} body={t('verify.rejectedBody')}>
              {record?.rejection_reason ? (
                <p className="text-sm text-ink-soft">
                  <span className="font-semibold">{t('verify.reason')}:</span> {record.rejection_reason}
                </p>
              ) : null}
            </StatePanel>
          ) : null}

          <Card className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-wash text-brand-600 ring-1 ring-inset ring-[color:var(--color-border-accent)]">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-muted">{t('verify.intro')}</p>
            </div>

            {error ? <Alert>{error}</Alert> : null}

            <FormField label={t('verify.documentType')} htmlFor="documentType">
              <Select id="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t(`verify.docTypes.${d}`)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('verify.document')} htmlFor="document">
              {filePicker(document, docRef, setDocument, 'verify.choose')}
            </FormField>

            <FormField label={t('verify.selfie')} htmlFor="selfie">
              {filePicker(selfie, selfieRef, setSelfie, 'verify.choose', true)}
            </FormField>

            <div className="flex items-center gap-2 text-xs text-muted">
              <Lock className="h-3.5 w-3.5 text-brand-500" aria-hidden />
              {t('verify.privacy')}
            </div>

            <Button size="lg" magnetic onClick={onSubmit} disabled={submit.isPending}>
              {submit.isPending ? t('common.pleaseWait') : status === 'rejected' ? t('verify.resubmit') : t('verify.submit')}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
