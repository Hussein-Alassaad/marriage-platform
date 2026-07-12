import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Film, ImageIcon } from 'lucide-react';

import { Skeleton } from '@/components/Skeleton';
import { useMediaUrl } from '@/hooks/useChat';

interface MediaBubbleProps {
  messageId: string;
  kind: 'image' | 'video';
  mine: boolean;
}

/**
 * An image or video. The file lives in a private bucket, so the URL is minted per
 * message, per viewer, for ten minutes.
 *
 * A video that hasn't cleared human review isn't signable — the server returns
 * `not_available`, and we say so plainly rather than showing a broken player. The
 * sender sees "awaiting review"; the recipient simply has nothing to open yet.
 */
export function MediaBubble({ messageId, kind, mine }: MediaBubbleProps) {
  const { t } = useTranslation();
  const [load, setLoad] = useState(kind === 'image');
  const { data: url, isLoading, error } = useMediaUrl(messageId, load);

  const pending = error instanceof Error && error.message === 'not_available';

  if (pending) {
    return (
      <span className="flex items-center gap-2 text-xs text-muted">
        <Clock className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
        {mine ? t('media.pendingMine') : t('media.pendingTheirs')}
      </span>
    );
  }

  if (isLoading) return <Skeleton className="h-40 w-56 rounded-xl" />;

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => setLoad(true)}
        className="flex items-center gap-2 rounded-full bg-bg-4 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-bg-3"
      >
        {kind === 'image' ? (
          <ImageIcon className="h-4 w-4 text-brand-600" aria-hidden />
        ) : (
          <Film className="h-4 w-4 text-brand-600" aria-hidden />
        )}
        {t(kind === 'image' ? 'media.viewImage' : 'media.playVideo')}
      </button>
    );
  }

  return kind === 'image' ? (
    <img src={url} alt={t('media.imageAlt')} className="max-h-72 w-full rounded-xl object-cover" />
  ) : (
    <video src={url} controls className="max-h-72 w-full rounded-xl" />
  );
}
