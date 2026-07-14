import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';

import { Skeleton } from '@/components/Skeleton';
import { useMediaUrl } from '@/hooks/useChat';

interface VoiceBubbleProps {
  messageId: string;
  transcript: string | null;
}

/**
 * A voice note. The audio lives in a private bucket, so the URL is fetched lazily
 * (and only for a participant) the first time someone chooses to listen — we don't
 * mint a signed URL for every note in the history on page load.
 *
 * The transcript is shown beneath: it is exactly what the moderator judged, so the
 * pair can always see why a note was allowed, and it keeps voice accessible.
 */
export function VoiceBubble({ messageId, transcript }: VoiceBubbleProps) {
  const { t } = useTranslation();
  const [load, setLoad] = useState(false);
  const { data: url, isLoading, isError } = useMediaUrl(messageId, load);

  return (
    <div className="min-w-[220px] space-y-2">
      {url ? (
        <audio src={url} controls autoPlay className="h-10 w-full" />
      ) : isLoading ? (
        <Skeleton className="h-10 w-full rounded-full" />
      ) : (
        <button
          type="button"
          onClick={() => setLoad(true)}
          className="bg-bg-4 text-ink hover:bg-bg-3 flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors"
        >
          <Play className="text-brand-600 h-4 w-4" aria-hidden />
          {t('voice.play')}
        </button>
      )}

      {isError ? <p className="text-danger text-xs">{t('voice.playError')}</p> : null}

      {transcript ? (
        <p className="text-muted text-xs leading-relaxed">
          <span className="text-faint font-medium">{t('voice.transcript')}: </span>
          {transcript}
        </p>
      ) : null}
    </div>
  );
}
