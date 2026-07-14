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
  // `super_admin` is an admin. Checking only 'admin' hid this whole queue from the very
  // role that is meant to be able to do everything.
  const isAdmin = hasRole('admin', 'super_admin');
  const { data: claims, isLoading, error } = usePendingClaims(isAdmin);
  const review = useReviewClaim();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isAdmin) return null;

  const act = async (claimId: string, decision: 'approved' | 'rejected') => {
    setBusy(claimId);
    setActionError(null);
    try {
      await review.mutateAsync({ claimId, decision });
    } catch (e) {
      // This used to be swallowed: the approval failed, the claim stayed pending, and the
      // screen said nothing at all. A failure you cannot see is the worst kind.
      setActionError(e instanceof Error ? e.message : 'unknown_error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h2 className="font-display text-ink mb-4 text-lg font-semibold">
        {t('admin.payments.title')}
      </h2>

      {/* The reason the approval failed, verbatim. Guessing at it from an empty screen is
          how an hour disappears. */}
      {actionError ? (
        <Card className="border-danger/30 mb-4 p-4">
          <p className="text-danger text-sm font-medium">{t('admin.payments.actionFailed')}</p>
          <p className="text-muted mt-1 font-mono text-xs break-all">{actionError}</p>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="rounded-card h-24" />
          <Skeleton className="rounded-card h-24" />
        </div>
      ) : error ? (
        <Card className="text-danger p-5 text-sm">{t('admin.payments.error')}</Card>
      ) : (claims ?? []).length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('admin.payments.emptyTitle')}
          description={t('admin.payments.emptyBody')}
        />
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
                  <p className="text-ink truncate font-medium">
                    {c.displayName ?? c.userId.slice(0, 8)}
                  </p>
                  <p className="text-muted mt-0.5 text-xs">
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
                    className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {t('admin.payments.viewReceipt')}
                  </a>
                ) : (
                  <span className="text-muted text-xs">{t('admin.payments.noReceipt')}</span>
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
