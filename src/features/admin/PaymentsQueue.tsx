import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ExternalLink, Inbox } from 'lucide-react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { EASE_OUT } from '@/lib/motion';
import { useSession } from '@/hooks/useSession';
import { usePendingClaims, useReviewClaim } from '@/hooks/useSubscription';

/**
 * Manual payment review. Approving activates the claimed tier for the exact period
 * the user paid for — the Edge Function reads that from the claim's audit entry,
 * not from this screen, so a reviewer can't grant more than was claimed.
 */
export function PaymentsQueue() {
  const { t } = useTranslation();
  const { hasRole } = useSession();
  const isAdmin = hasRole('admin');
  const { data: claims, isLoading, error } = usePendingClaims(isAdmin);
  const review = useReviewClaim();
  const [busy, setBusy] = useState<string | null>(null);

  if (!isAdmin) return null;

  const act = async (claimId: string, decision: 'approved' | 'rejected') => {
    setBusy(claimId);
    try {
      await review.mutateAsync({ claimId, decision });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">{t('admin.payments.title')}</h2>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </div>
      ) : error ? (
        <Card className="p-5 text-sm text-danger">{t('admin.payments.error')}</Card>
      ) : (claims ?? []).length === 0 ? (
        <EmptyState icon={Inbox} title={t('admin.payments.emptyTitle')} description={t('admin.payments.emptyBody')} />
      ) : (
        <div className="space-y-3">
          {(claims ?? []).map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: i * 0.04 }}
            >
              <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{c.displayName ?? c.userId.slice(0, 8)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t(`plans.method.${c.method}`)} · {t('admin.payments.ref')}{' '}
                    <span className="font-mono uppercase">{c.referenceCode}</span> ·{' '}
                    {new Date(c.submittedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {c.tier ? <Badge variant="brand">{t(`plans.tier.${c.tier}`)}</Badge> : null}
                  <Badge variant="neutral">{t(`plans.period.${c.period}`)}</Badge>
                  <Badge variant="gold">
                    {c.amount != null ? `${c.currency} ${c.amount}` : '—'}
                  </Badge>
                </div>

                {c.receiptUrl ? (
                  <a
                    href={c.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {t('admin.payments.viewReceipt')}
                  </a>
                ) : (
                  <span className="text-xs text-muted">{t('admin.payments.noReceipt')}</span>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="text-danger"
                    disabled={busy === c.id}
                    onClick={() => act(c.id, 'rejected')}
                  >
                    {t('admin.payments.reject')}
                  </Button>
                  <Button disabled={busy === c.id} onClick={() => act(c.id, 'approved')}>
                    {t('admin.payments.approve')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
