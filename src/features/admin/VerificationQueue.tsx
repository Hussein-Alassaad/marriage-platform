import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/Button';
import { Card, CardTitle } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Skeleton } from '@/components/Skeleton';
import { useLanguage } from '@/hooks/useLanguage';
import { useReviewVerification, useVerificationQueue } from '@/hooks/useAdmin';

/**
 * The queue that was missing. `verify-identity` has had a review action since Phase 5, but
 * nothing ever called it — so no member could actually be verified, and verification is
 * the gate in front of matchmaking. The platform was closed at the front door.
 *
 * Document links are short-lived signed URLs (10 minutes) into a bucket with no client
 * policies at all, and opening this queue is itself written to the audit log: Decision #15
 * promises members that only authorised admins see their documents, and a promise nobody
 * can check is not a promise.
 */
export function VerificationQueue() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data: queue, isLoading } = useVerificationQueue(true);
  const review = useReviewVerification();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="rounded-card h-40" />
        ))}
      </div>
    );
  }

  if (!queue?.length) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t('admin.verification.empty')}
        description={t('admin.verification.emptyBody')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <Card key={item.id} className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{item.profile?.display_name ?? t('admin.verification.unnamed')}</CardTitle>
            <span className="text-faint text-xs">
              {new Date(item.submittedAt).toLocaleDateString(language)}
            </span>
          </div>

          <dl className="text-muted mb-4 grid gap-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-faint text-xs">{t('admin.verification.documentType')}</dt>
              <dd className="text-ink-soft">{item.documentType ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-faint text-xs">{t('admin.verification.country')}</dt>
              <dd className="text-ink-soft">{item.profile?.country ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-faint text-xs">{t('admin.verification.dob')}</dt>
              <dd className="text-ink-soft">
                {item.profile?.dob ? new Date(item.profile.dob).toLocaleDateString(language) : '—'}
              </dd>
            </div>
          </dl>

          <div className="mb-4 flex flex-wrap gap-2">
            {item.documentUrl ? (
              <a
                href={item.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="border-line text-ink-soft hover:border-brand-400 hover:bg-brand-wash inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                {t('admin.verification.openDocument')}
              </a>
            ) : null}
            {item.selfieUrl ? (
              <a
                href={item.selfieUrl}
                target="_blank"
                rel="noreferrer"
                className="border-line text-ink-soft hover:border-brand-400 hover:bg-brand-wash inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                {t('admin.verification.openSelfie')}
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={reasons[item.id] ?? ''}
              onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
              placeholder={t('admin.verification.reasonPlaceholder')}
              className="h-10 max-w-sm"
            />
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: item.id, decision: 'verified' })}
            >
              {t('admin.verification.approve')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() =>
                review.mutate({ id: item.id, decision: 'rejected', reason: reasons[item.id] })
              }
            >
              {t('admin.verification.reject')}
            </Button>
          </div>
          <p className="text-faint mt-2 text-xs">{t('admin.verification.rejectHint')}</p>
        </Card>
      ))}
    </div>
  );
}
