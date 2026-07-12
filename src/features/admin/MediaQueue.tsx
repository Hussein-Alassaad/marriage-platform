import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { EASE_OUT } from '@/lib/motion';
import { useSession } from '@/hooks/useSession';
import { usePendingMedia, useReviewMedia } from '@/hooks/useChat';

/**
 * Human review for videos. No model can watch a video, so a video sent in the Family
 * stage is stored as `pending` and is NOT openable by the recipient until someone
 * here approves it. Rejecting deletes the file — we don't keep what we won't show.
 */
export function MediaQueue() {
  const { t } = useTranslation();
  const { hasRole } = useSession();
  const isAdmin = hasRole('admin');
  const { data: media, isLoading, error } = usePendingMedia(isAdmin);
  const review = useReviewMedia();
  const [busy, setBusy] = useState<string | null>(null);

  if (!isAdmin) return null;

  const act = async (messageId: string, decision: 'approved' | 'rejected') => {
    setBusy(messageId);
    try {
      await review.mutateAsync({ messageId, decision });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">{t('admin.media.title')}</h2>
      <p className="mb-4 text-sm text-muted">{t('admin.media.subtitle')}</p>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      ) : error ? (
        <Card className="p-5 text-sm text-danger">{t('admin.media.error')}</Card>
      ) : (media ?? []).length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('admin.media.emptyTitle')} description={t('admin.media.emptyBody')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(media ?? []).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: i * 0.04 }}
            >
              <Card className="flex h-full flex-col p-4">
                {m.url ? (
                  m.type === 'video' ? (
                    <video src={m.url} controls className="mb-3 max-h-64 w-full rounded-xl bg-black" />
                  ) : (
                    <img src={m.url} alt="" className="mb-3 max-h-64 w-full rounded-xl object-cover" />
                  )
                ) : (
                  <p className="mb-3 text-sm text-danger">{t('admin.media.noPreview')}</p>
                )}

                <p className="mb-3 text-xs text-muted">
                  {m.senderName ?? '—'} · {new Date(m.createdAt).toLocaleString()}
                </p>

                <div className="mt-auto flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    className="text-danger"
                    disabled={busy === m.id}
                    onClick={() => act(m.id, 'rejected')}
                  >
                    {t('admin.media.reject')}
                  </Button>
                  <Button disabled={busy === m.id} onClick={() => act(m.id, 'approved')}>
                    {t('admin.media.approve')}
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
