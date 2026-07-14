import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Film, ImageIcon } from 'lucide-react';

import { Skeleton } from '@/components/Skeleton';
import { useMediaUrl } from '@/hooks/useChat';

interface MediaBubbleProps {
  messageId: string;
  kind: 'image' | 'video';
}

/**
 * An image (or, later, a video). The file lives in a private bucket, so the URL is
 * minted per message, per viewer, for ten minutes — and only for media that actually
 * passed moderation.
 *
 * `video` is still handled here so old messages and a future video release render
 * without touching this component; nothing can currently create one.
 */
export function MediaBubble({ messageId, kind }: MediaBubbleProps) {
  const { t } = useTranslation();
  const [load, setLoad] = useState(kind === 'image');
  const { data: url, isLoading, isError } = useMediaUrl(messageId, load);

  if (isLoading) return <Skeleton className="h-40 w-56 rounded-xl" />;

  if (isError) return <p className="text-danger text-xs">{t('media.unavailable')}</p>;

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => setLoad(true)}
        className="bg-bg-4 text-ink hover:bg-bg-3 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors"
      >
        {kind === 'image' ? (
          <ImageIcon className="text-brand-600 h-4 w-4" aria-hidden />
        ) : (
          <Film className="text-brand-600 h-4 w-4" aria-hidden />
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
